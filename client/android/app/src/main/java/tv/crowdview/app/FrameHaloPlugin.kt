/**
 * FrameHaloPlugin.kt — Capacitor native plugin for Brilliant Labs Frame (Halo) glasses.
 *
 * Handles Android BLE scanning, connection, MTU negotiation, Lua upload,
 * fragmented TX writes, and reassembly of chunked photo/audio RX data.
 *
 * BLE service/characteristic UUIDs and message protocol match crowdview_app.lua.
 */

package tv.crowdview.app

import android.bluetooth.*
import android.bluetooth.le.ScanCallback
import android.bluetooth.le.ScanFilter
import android.bluetooth.le.ScanResult
import android.bluetooth.le.ScanSettings
import android.content.Context
import android.os.Build
import android.os.ParcelUuid
import com.getcapacitor.JSArray
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin
import java.util.UUID

// ── BLE constants ──────────────────────────────────────────────────────────────
private val SERVICE_UUID = UUID.fromString("7A230001-5475-A6A4-654C-8431F6AD49C4")
private val TX_CHAR_UUID = UUID.fromString("7A230002-5475-A6A4-654C-8431F6AD49C4")
private val RX_CHAR_UUID = UUID.fromString("7A230003-5475-A6A4-654C-8431F6AD49C4")
private val CCCD_UUID    = UUID.fromString("00002902-0000-1000-8000-00805F9B34FB")

private const val CTRL_BREAK: Byte = 0x03
private const val CTRL_RESET: Byte = 0x04

// RX response codes (glasses → phone, must match crowdview_app.lua)
private const val RSP_PHOTO_CHUNK: Byte = 0x01
private const val RSP_PHOTO_DONE:  Byte = 0x02
private const val RSP_AUDIO:       Byte = 0x03
private const val RSP_TAP:         Byte = 0x09

@CapacitorPlugin(name = "FrameHalo")
class FrameHaloPlugin : Plugin() {

    private var gatt:        BluetoothGatt? = null
    private var txChar:      BluetoothGattCharacteristic? = null
    private var rxChar:      BluetoothGattCharacteristic? = null
    private var mtu          = 182  // conservative default; updated after requestMtu
    private var connectCall: PluginCall? = null
    private val photoBuffer  = mutableListOf<Byte>()

    private val bluetoothManager by lazy {
        activity.getSystemService(Context.BLUETOOTH_SERVICE) as BluetoothManager
    }

    // ── Scan callback ────────────────────────────────────────────────────────

    private val scanCallback = object : ScanCallback() {
        override fun onScanResult(callbackType: Int, result: ScanResult) {
            bluetoothManager.adapter.bluetoothLeScanner?.stopScan(this)
            connectToDevice(result.device)
        }
        override fun onScanFailed(errorCode: Int) {
            connectCall?.reject("BLE scan failed: $errorCode")
            connectCall = null
        }
    }

    // ── JS-callable methods ───────────────────────────────────────────────────

    @PluginMethod
    fun connect(call: PluginCall) {
        connectCall = call
        val filter = ScanFilter.Builder()
            .setServiceUuid(ParcelUuid(SERVICE_UUID)).build()
        val settings = ScanSettings.Builder()
            .setScanMode(ScanSettings.SCAN_MODE_LOW_LATENCY).build()
        bluetoothManager.adapter.bluetoothLeScanner
            ?.startScan(listOf(filter), settings, scanCallback)
            ?: call.reject("Bluetooth LE scanner unavailable")
    }

    @PluginMethod
    fun disconnect(call: PluginCall) {
        gatt?.disconnect()
        call.resolve()
    }

    @PluginMethod
    fun sendLua(call: PluginCall) {
        val code = call.getString("code") ?: run { call.reject("Missing code"); return }
        writeChunked(code.toByteArray(Charsets.UTF_8))
        call.resolve()
    }

    @PluginMethod
    fun sendCommand(call: PluginCall) {
        val msgCode = call.getInt("msgCode") ?: run { call.reject("Missing msgCode"); return }
        val payload = call.getArray("payload")?.toList<Int>()
            ?.map { it.toByte() } ?: emptyList()
        val bytes = byteArrayOf(msgCode.toByte()) + payload.toByteArray()
        writeChunked(bytes)
        call.resolve()
    }

    @PluginMethod
    fun uploadApp(call: PluginCall) {
        val lua = call.getString("lua") ?: run { call.reject("Missing lua"); return }
        // Break → 150 ms → Reset → 250 ms → Lua source
        writeRaw(byteArrayOf(CTRL_BREAK))
        bridge.executeOnMainThread {
            Thread.sleep(150)
            writeRaw(byteArrayOf(CTRL_RESET))
            Thread.sleep(250)
            writeChunked(lua.toByteArray(Charsets.UTF_8))
            call.resolve()
        }
    }

    // ── BLE device connect ────────────────────────────────────────────────────

    private fun connectToDevice(device: BluetoothDevice) {
        gatt = device.connectGatt(context, false, gattCallback, BluetoothDevice.TRANSPORT_LE)
    }

    // ── Write helpers ─────────────────────────────────────────────────────────

    private fun writeChunked(data: ByteArray) {
        val char = txChar ?: return
        var offset = 0
        while (offset < data.size) {
            val end   = minOf(offset + mtu, data.size)
            val chunk = data.copyOfRange(offset, end)
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                gatt?.writeCharacteristic(char, chunk, BluetoothGattCharacteristic.WRITE_TYPE_NO_RESPONSE)
            } else {
                @Suppress("DEPRECATION")
                char.value = chunk
                @Suppress("DEPRECATION")
                gatt?.writeCharacteristic(char)
            }
            offset = end
            Thread.sleep(20) // small inter-chunk delay
        }
    }

    private fun writeRaw(data: ByteArray) {
        val char = txChar ?: return
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            gatt?.writeCharacteristic(char, data, BluetoothGattCharacteristic.WRITE_TYPE_NO_RESPONSE)
        } else {
            @Suppress("DEPRECATION")
            char.value = data
            @Suppress("DEPRECATION")
            gatt?.writeCharacteristic(char)
        }
    }

    // ── GATT callbacks ────────────────────────────────────────────────────────

    private val gattCallback = object : BluetoothGattCallback() {

        override fun onConnectionStateChange(gatt: BluetoothGatt, status: Int, newState: Int) {
            when (newState) {
                BluetoothProfile.STATE_CONNECTED    -> gatt.requestMtu(251)
                BluetoothProfile.STATE_DISCONNECTED -> {
                    this@FrameHaloPlugin.gatt = null
                    txChar = null; rxChar = null
                    notifyListeners("frameDisconnected", JSObject())
                }
            }
        }

        override fun onMtuChanged(gatt: BluetoothGatt, mtu: Int, status: Int) {
            if (status == BluetoothGatt.GATT_SUCCESS) {
                this@FrameHaloPlugin.mtu = mtu - 3  // subtract ATT overhead
            }
            gatt.discoverServices()
        }

        override fun onServicesDiscovered(gatt: BluetoothGatt, status: Int) {
            if (status != BluetoothGatt.GATT_SUCCESS) {
                connectCall?.reject("Service discovery failed"); connectCall = null; return
            }
            val service = gatt.getService(SERVICE_UUID) ?: run {
                connectCall?.reject("Frame service not found"); connectCall = null; return
            }
            txChar = service.getCharacteristic(TX_CHAR_UUID)
            rxChar = service.getCharacteristic(RX_CHAR_UUID)?.also { char ->
                gatt.setCharacteristicNotification(char, true)
                char.getDescriptor(CCCD_UUID)?.let { desc ->
                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                        gatt.writeDescriptor(desc, BluetoothGattDescriptor.ENABLE_NOTIFICATION_VALUE)
                    } else {
                        @Suppress("DEPRECATION")
                        desc.value = BluetoothGattDescriptor.ENABLE_NOTIFICATION_VALUE
                        @Suppress("DEPRECATION")
                        gatt.writeDescriptor(desc)
                    }
                }
            }
            connectCall?.resolve(); connectCall = null
            notifyListeners("frameConnected", JSObject())
        }

        @Deprecated("Deprecated in API 33; still needed for pre-33 devices")
        override fun onCharacteristicChanged(
            gatt: BluetoothGatt,
            characteristic: BluetoothGattCharacteristic
        ) {
            handleRx(characteristic.value ?: return)
        }

        override fun onCharacteristicChanged(
            gatt: BluetoothGatt,
            characteristic: BluetoothGattCharacteristic,
            value: ByteArray
        ) {
            handleRx(value)
        }
    }

    private fun handleRx(raw: ByteArray) {
        if (raw.isEmpty()) return
        val code    = raw[0]
        val payload = if (raw.size > 1) raw.copyOfRange(1, raw.size) else ByteArray(0)

        when (code) {
            RSP_TAP -> {
                notifyListeners("frameData", JSObject().apply {
                    put("msgCode", RSP_TAP.toInt() and 0xFF)
                })
            }
            RSP_PHOTO_CHUNK -> photoBuffer.addAll(payload.toList())
            RSP_PHOTO_DONE  -> {
                photoBuffer.addAll(payload.toList())
                val arr = JSArray().apply {
                    photoBuffer.forEach { put(it.toInt() and 0xFF) }
                }
                notifyListeners("frameData", JSObject().apply {
                    put("msgCode", RSP_PHOTO_DONE.toInt() and 0xFF)
                    put("data",    arr)
                })
                photoBuffer.clear()
            }
            RSP_AUDIO -> {
                val arr = JSArray().apply { payload.forEach { put(it.toInt() and 0xFF) } }
                notifyListeners("frameData", JSObject().apply {
                    put("msgCode", RSP_AUDIO.toInt() and 0xFF)
                    put("data",    arr)
                })
            }
            else -> {
                val str = String(raw, Charsets.UTF_8)
                notifyListeners("frameData", JSObject().apply {
                    put("msgCode", 0xFF)
                    put("str",     str)
                })
            }
        }
    }
}
