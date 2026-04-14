/**
 * FrameHaloPlugin.swift — Capacitor native plugin for Brilliant Labs Frame (Halo) glasses.
 *
 * Handles CoreBluetooth scanning, connection, MTU negotiation, Lua upload,
 * fragmented TX writes, and reassembly of chunked photo/audio RX data.
 *
 * BLE service/characteristic UUIDs and message protocol match crowdview_app.lua.
 */

import Foundation
import Capacitor
import CoreBluetooth

// MARK: - BLE constants

private let kServiceUUID = CBUUID(string: "7A230001-5475-A6A4-654C-8431F6AD49C4")
private let kTxCharUUID  = CBUUID(string: "7A230002-5475-A6A4-654C-8431F6AD49C4")
private let kRxCharUUID  = CBUUID(string: "7A230003-5475-A6A4-654C-8431F6AD49C4")

// Control bytes
private let kBreak: UInt8 = 0x03
private let kReset: UInt8 = 0x04

// RX response codes (glasses → phone, must match crowdview_app.lua)
private let kRspPhotoChunk: UInt8 = 0x01
private let kRspPhotoDone:  UInt8 = 0x02
private let kRspAudio:      UInt8 = 0x03
private let kRspTap:        UInt8 = 0x09

// MARK: - Plugin declaration

@objc(FrameHaloPlugin)
public class FrameHaloPlugin: CAPPlugin, CAPBridgedPlugin,
                               CBCentralManagerDelegate, CBPeripheralDelegate {

    public let identifier   = "FrameHaloPlugin"
    public let jsName       = "FrameHalo"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "connect",     returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "disconnect",  returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "sendLua",     returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "sendCommand", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "uploadApp",   returnType: CAPPluginReturnPromise),
    ]

    private var central:     CBCentralManager!
    private var peripheral:  CBPeripheral?
    private var txChar:      CBCharacteristic?
    private var rxChar:      CBCharacteristic?
    private var mtu          = 182   // conservative; updated after MTU negotiation
    private var connectCall: CAPPluginCall?
    private var photoBuffer  = Data()

    public override func load() {
        central = CBCentralManager(delegate: self, queue: .main)
    }

    // MARK: - JS-callable methods

    @objc func connect(_ call: CAPPluginCall) {
        connectCall = call
        if central.state == .poweredOn {
            central.scanForPeripherals(withServices: [kServiceUUID], options: nil)
        }
        // If BT not yet ready, scan is deferred to centralManagerDidUpdateState
    }

    @objc func disconnect(_ call: CAPPluginCall) {
        if let p = peripheral { central.cancelPeripheralConnection(p) }
        call.resolve()
    }

    @objc func sendLua(_ call: CAPPluginCall) {
        guard let code = call.getString("code"),
              let data = code.data(using: .utf8) else {
            call.reject("Missing or unencoded code"); return
        }
        writeChunked(data)
        call.resolve()
    }

    @objc func sendCommand(_ call: CAPPluginCall) {
        guard let msgCode = call.getInt("msgCode") else {
            call.reject("Missing msgCode"); return
        }
        let payload = (call.getArray("payload") as? [Int] ?? []).map { UInt8($0 & 0xFF) }
        var bytes = [UInt8(msgCode & 0xFF)] + payload
        writeChunked(Data(bytes))
        call.resolve()
    }

    @objc func uploadApp(_ call: CAPPluginCall) {
        guard let lua = call.getString("lua"),
              let luaData = lua.data(using: .utf8) else {
            call.reject("Missing or unencoded lua"); return
        }
        // Break → short pause → Reset → short pause → Lua source
        writeRaw(Data([kBreak]))
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.15) { [weak self] in
            self?.writeRaw(Data([kReset]))
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.25) { [weak self] in
                self?.writeChunked(luaData)
                call.resolve()
            }
        }
    }

    // MARK: - Write helpers

    private func writeChunked(_ data: Data) {
        guard let char = txChar, let p = peripheral else { return }
        var offset = data.startIndex
        while offset < data.endIndex {
            let end   = data.index(offset, offsetBy: mtu, limitedBy: data.endIndex) ?? data.endIndex
            let chunk = data[offset..<end]
            p.writeValue(chunk, for: char, type: .withoutResponse)
            offset = end
        }
    }

    private func writeRaw(_ data: Data) {
        guard let char = txChar, let p = peripheral else { return }
        p.writeValue(data, for: char, type: .withoutResponse)
    }

    // MARK: - CBCentralManagerDelegate

    public func centralManagerDidUpdateState(_ central: CBCentralManager) {
        guard central.state == .poweredOn, connectCall != nil else { return }
        central.scanForPeripherals(withServices: [kServiceUUID], options: nil)
    }

    public func centralManager(_ central: CBCentralManager,
                                didDiscover peripheral: CBPeripheral,
                                advertisementData: [String: Any],
                                rssi RSSI: NSNumber) {
        central.stopScan()
        self.peripheral = peripheral
        peripheral.delegate = self
        central.connect(peripheral, options: nil)
    }

    public func centralManager(_ central: CBCentralManager,
                                didConnect peripheral: CBPeripheral) {
        // Request maximum MTU (251 byte payload per BLE 5.x spec)
        mtu = peripheral.maximumWriteValueLength(for: .withoutResponse)
        peripheral.discoverServices([kServiceUUID])
    }

    public func centralManager(_ central: CBCentralManager,
                                didDisconnectPeripheral peripheral: CBPeripheral,
                                error: Error?) {
        self.peripheral = nil; txChar = nil; rxChar = nil
        notifyListeners("frameDisconnected", data: [:])
    }

    public func centralManager(_ central: CBCentralManager,
                                didFailToConnect peripheral: CBPeripheral,
                                error: Error?) {
        connectCall?.reject(error?.localizedDescription ?? "Connect failed")
        connectCall = nil
    }

    // MARK: - CBPeripheralDelegate

    public func peripheral(_ peripheral: CBPeripheral,
                           didDiscoverServices error: Error?) {
        guard error == nil,
              let svc = peripheral.services?.first(where: { $0.uuid == kServiceUUID }) else { return }
        peripheral.discoverCharacteristics([kTxCharUUID, kRxCharUUID], for: svc)
    }

    public func peripheral(_ peripheral: CBPeripheral,
                           didDiscoverCharacteristicsFor service: CBService,
                           error: Error?) {
        guard error == nil else {
            connectCall?.reject(error!.localizedDescription); connectCall = nil; return
        }
        for char in service.characteristics ?? [] {
            if char.uuid == kTxCharUUID { txChar = char }
            if char.uuid == kRxCharUUID {
                rxChar = char
                peripheral.setNotifyValue(true, for: char)
            }
        }
        if txChar != nil && rxChar != nil {
            connectCall?.resolve()
            connectCall = nil
            notifyListeners("frameConnected", data: [:])
        }
    }

    public func peripheral(_ peripheral: CBPeripheral,
                           didUpdateValueFor characteristic: CBCharacteristic,
                           error: Error?) {
        guard characteristic.uuid == kRxCharUUID,
              error == nil,
              let raw = characteristic.value,
              !raw.isEmpty else { return }

        let code    = raw[0]
        let payload = raw.count > 1 ? raw[raw.index(after: raw.startIndex)...] : Data()

        switch code {
        case kRspTap:
            notifyListeners("frameData", data: ["msgCode": Int(kRspTap)])

        case kRspPhotoChunk:
            photoBuffer.append(contentsOf: payload)

        case kRspPhotoDone:
            photoBuffer.append(contentsOf: payload)
            let bytes = photoBuffer.map { Int($0) }
            notifyListeners("frameData", data: [
                "msgCode": Int(kRspPhotoDone),
                "data":    bytes,
            ])
            photoBuffer.removeAll(keepingCapacity: true)

        case kRspAudio:
            let bytes = payload.map { Int($0) }
            notifyListeners("frameData", data: [
                "msgCode": Int(kRspAudio),
                "data":    bytes,
            ])

        default:
            // Lua print() output forwarded as a debug string
            if let str = String(data: raw, encoding: .utf8) {
                notifyListeners("frameData", data: ["msgCode": 0xFF, "str": str])
            }
        }
    }
}
