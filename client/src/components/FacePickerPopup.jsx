import React from 'react';
import { XIcon } from './Icons';

function cropFace(imageDataUrl, box) {
  return new Promise(resolve => {
    const img = new Image();
    img.onload = () => {
      const w = img.naturalWidth;
      const h = img.naturalHeight;
      const pad = 0.12;
      const left   = Math.max(0, Math.floor((box.left  - box.width  * pad) * w));
      const top    = Math.max(0, Math.floor((box.top   - box.height * pad) * h));
      const width  = Math.min(w - left, Math.ceil(box.width  * (1 + 2 * pad) * w));
      const height = Math.min(h - top,  Math.ceil(box.height * (1 + 2 * pad) * h));
      const canvas = document.createElement('canvas');
      canvas.width  = width;
      canvas.height = height;
      canvas.getContext('2d').drawImage(img, left, top, width, height, 0, 0, width, height);
      resolve(canvas.toDataURL('image/jpeg'));
    };
    img.src = imageDataUrl;
  });
}

export default function FacePickerPopup({ imageDataUrl, faces, onSelectFace, onCancel }) {
  async function handleFaceClick(face) {
    const cropped = await cropFace(imageDataUrl, face.boundingBox);
    onSelectFace(cropped);
  }

  return (
    <div className="fixed inset-0 bg-black/80 flex flex-col items-center justify-center z-50 p-4">
      <div className="bg-gray-800 rounded-xl shadow-2xl w-full max-w-2xl flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-700 flex-shrink-0">
          <div>
            <h2 className="text-white font-semibold text-lg">Select a Face</h2>
            <p className="text-gray-400 text-sm">
              {faces.length === 0
                ? 'No faces were detected in this photo'
                : `${faces.length} face${faces.length !== 1 ? 's' : ''} detected — click one to add as a friend`}
            </p>
          </div>
          <button onClick={onCancel} className="text-gray-400 hover:text-white">
            <XIcon className="w-5 h-5" />
          </button>
        </div>

        {/* Image with face overlays */}
        <div className="flex-1 overflow-auto p-4 flex items-center justify-center">
          <div className="relative inline-block">
            <img
              src={imageDataUrl}
              alt="Uploaded"
              className="max-w-full max-h-[60vh] rounded-lg block"
              draggable={false}
            />
            {faces.map((face, i) => {
              const { left, top, width, height } = face.boundingBox;
              return (
                <button
                  key={face.faceId || i}
                  onClick={() => handleFaceClick(face)}
                  title={face.friendName ? `Known: ${face.friendName}` : 'Unknown — click to add as friend'}
                  style={{
                    position: 'absolute',
                    left:   `${left   * 100}%`,
                    top:    `${top    * 100}%`,
                    width:  `${width  * 100}%`,
                    height: `${height * 100}%`,
                  }}
                  className={`border-2 rounded transition-all hover:bg-white/20 ${
                    face.status === 'known'
                      ? 'border-green-400 hover:border-green-300'
                      : 'border-yellow-400 hover:border-yellow-300'
                  }`}
                >
                  {/* Label at bottom of box */}
                  <span className={`absolute bottom-0 left-0 right-0 text-center text-xs px-1 py-0.5 truncate ${
                    face.status === 'known'
                      ? 'bg-green-700/80 text-green-100'
                      : 'bg-yellow-700/80 text-yellow-100'
                  }`}>
                    {face.status === 'known' ? face.friendName : 'Unknown'}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-gray-700 flex justify-end flex-shrink-0">
          <button
            onClick={onCancel}
            className="px-5 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg text-sm"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
