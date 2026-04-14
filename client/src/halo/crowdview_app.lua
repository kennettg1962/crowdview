-- crowdview_app.lua — CrowdView on-device app for Brilliant Labs Frame (Halo)
-- Upload this file to the Frame via HaloSDK.connect() → FrameHaloPlugin.uploadApp()
--
-- Protocol: all multi-byte integers big-endian.
--
-- Commands  (phone → glasses, received in frame.bluetooth.receive_callback)
local CMD_CAPTURE    = 0x10  -- [] trigger camera capture
local CMD_TEXT       = 0x11  -- [x_hi][x_lo][y_hi][y_lo][color][utf8...] show text
local CMD_CLEAR      = 0x12  -- [] clear display
local CMD_AUDIO_ON   = 0x13  -- [] start PCM streaming from mic
local CMD_AUDIO_OFF  = 0x14  -- [] stop PCM streaming

-- Responses (glasses → phone, sent via frame.bluetooth.send)
local RSP_PHOTO_CHUNK = 0x01  -- [jpeg_bytes...] non-final JPEG chunk
local RSP_PHOTO_DONE  = 0x02  -- [jpeg_bytes...] final JPEG chunk (reassemble complete)
local RSP_AUDIO       = 0x03  -- [pcm_bytes...]  8-bit signed 8 kHz mono PCM chunk
local RSP_TAP         = 0x09  -- [] tap detected

local audio_streaming = false

-- ── Receive commands from phone ───────────────────────────────────────────────
frame.bluetooth.receive_callback(function(data)
  if #data < 1 then return end
  local cmd = string.byte(data, 1)

  if cmd == CMD_CAPTURE then
    -- Trigger a 512-pixel, quality-3 capture; result arrives in image_callback
    frame.camera.capture({ quality_index = 3, resolution = 512 })

  elseif cmd == CMD_TEXT then
    if #data < 6 then return end
    local x     = string.byte(data, 2) * 256 + string.byte(data, 3)
    local y     = string.byte(data, 4) * 256 + string.byte(data, 5)
    local color = string.byte(data, 6)
    local text  = string.sub(data, 7)
    frame.display.text(text, x, y, { color = color })
    frame.display.show()

  elseif cmd == CMD_CLEAR then
    frame.display.clear()
    frame.display.show()

  elseif cmd == CMD_AUDIO_ON then
    audio_streaming = true
    frame.microphone.start({ sample_rate = 8000, bit_depth = 8 })

  elseif cmd == CMD_AUDIO_OFF then
    audio_streaming = false
    frame.microphone.stop()
  end
end)

-- ── Tap → notify phone ────────────────────────────────────────────────────────
frame.imu.tap_callback(function()
  frame.bluetooth.send(string.char(RSP_TAP))
end)

-- ── Camera image → chunk and send to phone ────────────────────────────────────
frame.camera.image_callback(function(jpeg_data)
  -- Reserve 1 byte for the response code prefix
  local chunk_size = frame.bluetooth.max_length() - 1
  local total  = #jpeg_data
  local offset = 1
  while offset <= total do
    local ends  = math.min(offset + chunk_size - 1, total)
    local chunk = string.sub(jpeg_data, offset, ends)
    local is_last = (ends >= total)
    local code    = is_last and RSP_PHOTO_DONE or RSP_PHOTO_CHUNK
    frame.bluetooth.send(string.char(code) .. chunk)
    offset = ends + 1
  end
end)

-- ── Audio → stream chunks to phone ───────────────────────────────────────────
frame.microphone.callback(function(audio_data)
  if not audio_streaming then return end
  frame.bluetooth.send(string.char(RSP_AUDIO) .. audio_data)
end)

-- ── Main loop ─────────────────────────────────────────────────────────────────
while true do
  frame.sleep(0.05)
end
