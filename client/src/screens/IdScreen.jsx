import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import AppHeader from '../components/AppHeader';
import TrueFooter from '../components/TrueFooter';
import FriendFormPopup from '../components/FriendFormPopup';
import { MovieCameraIcon, FriendsIcon, BackIcon } from '../components/Icons';
import useVoiceCommands from '../hooks/useVoiceCommands';
import api from '../api/api';

const STATUS_COLORS = {
  known: { border: '#22c55e', label: 'bg-green-500' },
  identified: { border: '#f97316', label: 'bg-orange-500' },
  unknown: { border: '#ef4444', label: 'bg-red-500' },
};

export default function IdScreen() {
  const navigate = useNavigate();
  const location = useLocation();
  const canvasRef = useRef(null);
  const [faces, setFaces] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedFaceIndex, setSelectedFaceIndex] = useState(0);
  const [showFriendForm, setShowFriendForm] = useState(false);
  const [activeFace, setActiveFace] = useState(null);
  const photoDataUrl = location.state?.photoDataUrl;

  const handlePrev = useCallback(() => {
    setSelectedFaceIndex(i => Math.max(0, i - 1));
  }, []);

  const handleNext = useCallback(() => {
    setSelectedFaceIndex(i => Math.min(faces.length - 1, i + 1));
  }, [faces.length]);

  const handleShow = useCallback(() => {
    if (faces[selectedFaceIndex]) {
      setActiveFace(faces[selectedFaceIndex]);
      setShowFriendForm(true);
    }
  }, [faces, selectedFaceIndex]);

  useVoiceCommands({
    screen: 'id',
    commands: { prev: handlePrev, next: handleNext, show: handleShow }
  });

  useEffect(() => {
    if (photoDataUrl) {
      identifyFaces();
      drawImageOnCanvas();
    }
  }, [photoDataUrl]);

  async function identifyFaces() {
    setLoading(true);
    try {
      const res = await api.post('/api/rekognition/identify', { imageData: photoDataUrl });
      setFaces(res.data.faces || []);
      // Draw bounding boxes after faces are loaded
      setTimeout(() => drawBoundingBoxes(res.data.faces || []), 100);
    } catch (err) {
      console.error('Identification failed', err);
      setFaces([]);
    } finally {
      setLoading(false);
    }
  }

  function drawImageOnCanvas() {
    const canvas = canvasRef.current;
    if (!canvas || !photoDataUrl) return;
    const img = new Image();
    img.onload = () => {
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0);
    };
    img.src = photoDataUrl;
  }

  function drawBoundingBoxes(detectedFaces) {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    // Redraw the image first
    const img = new Image();
    img.onload = () => {
      ctx.drawImage(img, 0, 0);
      detectedFaces.forEach(face => {
        const color = STATUS_COLORS[face.status]?.border || '#ffffff';
        const x = face.boundingBox.left * canvas.width;
        const y = face.boundingBox.top * canvas.height;
        const w = face.boundingBox.width * canvas.width;
        const h = face.boundingBox.height * canvas.height;
        ctx.strokeStyle = color;
        ctx.lineWidth = 3;
        ctx.strokeRect(x, y, w, h);
        // Label
        if (face.friendName) {
          ctx.fillStyle = color + 'cc';
          ctx.fillRect(x, y - 22, Math.min(w, 140), 22);
          ctx.fillStyle = '#ffffff';
          ctx.font = '13px sans-serif';
          ctx.fillText(face.friendName, x + 4, y - 6);
        }
      });
    };
    img.src = photoDataUrl;
  }

  function handleFaceClick(face, index) {
    setSelectedFaceIndex(index);
    setActiveFace(face);
    setShowFriendForm(true);
  }

  return (
    <div className="min-h-screen bg-gray-900 flex flex-col">
      {/* Header */}
      <AppHeader
        left={
          <button onClick={() => navigate('/hub')} className="text-gray-300 hover:text-white p-2 rounded-lg hover:bg-gray-700">
            <MovieCameraIcon className="w-5 h-5" />
          </button>
        }
        center={<span className="text-white font-bold text-xl tracking-wide">CrowdView</span>}
        right={
          <button onClick={() => navigate('/friends')} className="text-gray-300 hover:text-white p-2 rounded-lg hover:bg-gray-700">
            <FriendsIcon className="w-5 h-5" />
          </button>
        }
      />

      {/* Detected Faces Strip */}
      <div className="bg-gray-800 border-b border-gray-700 px-4 py-2">
        {loading ? (
          <div className="flex items-center gap-3 text-gray-400 text-sm">
            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-500" />
            <span>Working On Identifying Friends...</span>
          </div>
        ) : faces.length === 0 ? (
          <p className="text-gray-500 text-sm">No faces detected</p>
        ) : (
          <div className="flex gap-3 overflow-x-auto pb-1">
            {faces.map((face, i) => {
              const colors = STATUS_COLORS[face.status] || STATUS_COLORS.unknown;
              return (
                <button
                  key={face.faceId}
                  onClick={() => handleFaceClick(face, i)}
                  title={face.note || face.matchedLabel}
                  className={`flex-shrink-0 flex flex-col items-center gap-1 p-1 rounded-lg transition-colors ${
                    selectedFaceIndex === i ? 'bg-gray-700' : 'hover:bg-gray-700'
                  }`}
                >
                  <div
                    className="w-12 h-12 rounded-full bg-gray-700 border-2 overflow-hidden flex items-center justify-center"
                    style={{ borderColor: colors.border }}
                  >
                    <span className="text-gray-500 text-xl">👤</span>
                  </div>
                  <span className="text-white text-xs max-w-[60px] truncate text-center">
                    {face.friendName || 'Unknown'}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Main: photo + bounding boxes */}
      <main className="flex-1 relative overflow-hidden flex items-center justify-center p-2">
        {/* Back button */}
        <button
          onClick={() => navigate('/hub')}
          className="absolute top-3 left-3 z-10 flex items-center gap-1 px-3 py-1.5 bg-gray-800/90 hover:bg-gray-700 text-white rounded-lg text-sm"
        >
          <BackIcon className="w-4 h-4" />
          <span>Back</span>
        </button>

        {photoDataUrl ? (
          <div className="relative w-full max-w-3xl">
            <canvas
              ref={canvasRef}
              className="w-full rounded-xl border border-gray-700"
              style={{ maxHeight: '60vh', objectFit: 'contain' }}
            />
          </div>
        ) : (
          <div className="text-gray-500 text-center">
            <p>No photo to display</p>
            <button onClick={() => navigate('/hub')} className="text-blue-400 hover:text-blue-300 mt-2 underline text-sm">
              Return to Hub
            </button>
          </div>
        )}
      </main>

      <TrueFooter />

      {showFriendForm && activeFace && (
        <FriendFormPopup
          friend={activeFace.friendId ? { Friend_Id: activeFace.friendId, Name_Txt: activeFace.friendName } : null}
          onClose={() => setShowFriendForm(false)}
          onSave={() => {}}
        />
      )}
    </div>
  );
}
