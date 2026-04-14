/**
 * FrameHaloPlugin.js — Capacitor JS bridge for the Brilliant Labs Frame (Halo) glasses.
 *
 * Native implementations:
 *   iOS:     client/ios/App/App/FrameHaloPlugin.swift   (CoreBluetooth)
 *   Android: client/android/app/src/main/java/tv/crowdview/app/FrameHaloPlugin.kt
 *
 * Events emitted by native layer (listen via addListener):
 *   'frameConnected'    — BLE connection established and Lua app uploaded
 *   'frameDisconnected' — BLE connection lost
 *   'frameData'         — { msgCode: number, data?: number[], str?: string }
 */

import { registerPlugin } from '@capacitor/core';

const FrameHalo = registerPlugin('FrameHalo', {
  // Web stub — BLE is not available in a browser context
  web: () => ({
    connect:      () => Promise.reject(new Error('FrameHalo: BLE not available on web')),
    disconnect:   () => Promise.resolve(),
    sendLua:      () => Promise.resolve(),
    sendCommand:  () => Promise.resolve(),
    uploadApp:    () => Promise.resolve(),
    addListener:  (_event, _cb) => ({ remove: () => {} }),
    removeAllListeners: () => Promise.resolve(),
  }),
});

export default FrameHalo;
