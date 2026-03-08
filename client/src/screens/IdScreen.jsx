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
  const imgRef = useRef(null);
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
      loadImage(photoDataUrl).then(img => drawImageOnCanvas(img));
      identifyFaces();
    }
  }, [photoDataUrl]);

  function loadImage(src) {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.src = src;
    });
  }

  async function cropFaceThumbnails(detectedFaces, img) {
    return detectedFaces.map(face => {
      const bb = face.boundingBox;
      const x = Math.floor(bb.left * img.width);
      const y = Math.floor(bb.top * img.height);
      const w = Math.ceil(bb.width * img.width);
      const h = Math.ceil(bb.height * img.height);
      const offscreen = document.createElement('canvas');
      offscreen.width = w;
      offscreen.height = h;
      offscreen.getContext('2d').drawImage(img, x, y, w, h, 0, 0, w, h);
      return { ...face, thumbnailUrl: offscreen.toDataURL('image/jpeg') };
    });
  }

  async function identifyFaces() {
    setLoading(true);
    try {
      const [res, img] = await Promise.all([
        api.post('/api/rekognition/identify', { imageData: photoDataUrl }),
        loadImage(photoDataUrl),
      ]);
      imgRef.current = img;
      const rawFaces = res.data.faces || [];
      const facesWithThumbs = await cropFaceThumbnails(rawFaces, img);
      setFaces(facesWithThumbs);
      drawBoundingBoxes(facesWithThumbs, img);
    } catch (err) {
      console.error('Identification failed', err);
      setFaces([]);
    } finally {
      setLoading(false);
    }
  }

  function drawImageOnCanvas(img) {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.width = img.width;
    canvas.height = img.height;
    canvas.getContext('2d').drawImage(img, 0, 0);
  }

  function drawBoundingBoxes(detectedFaces, img) {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.width = img.width;
    canvas.height = img.height;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0);
    detectedFaces.forEach(face => {
      const color = STATUS_COLORS[face.status]?.border || '#ffffff';
      const x = face.boundingBox.left * img.width;
      const y = face.boundingBox.top * img.height;
      const w = face.boundingBox.width * img.width;
      const h = face.boundingBox.height * img.height;
      ctx.strokeStyle = color;
      ctx.lineWidth = 3;
      ctx.strokeRect(x, y, w, h);
      if (face.friendName) {
        ctx.fillStyle = color + 'cc';
        ctx.fillRect(x, y - 22, Math.min(w, 140), 22);
        ctx.fillStyle = '#ffffff';
        ctx.font = '13px sans-serif';
        ctx.fillText(face.friendName, x + 4, y - 6);
      }
    });
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
            <MovieCameraIcon className="w-[30px] h-[30px]" />
          </button>
        }
        center={<span className="text-white font-bold text-xl tracking-wide">CrowdView</span>}
        right={
          <button onClick={() => navigate('/friends')} className="text-gray-300 hover:text-white p-2 rounded-lg hover:bg-gray-700">
            <FriendsIcon className="w-[30px] h-[30px]" />
          </button>
        }
      />

      {/* Detected Faces Strip */}
      <div className="bg-gray-800 border-b border-gray-700 px-4 py-2">
        {loading ? (
          <div className="flex items-center gap-3 text-gray-400 text-sm">
            <div className="animate-spin rounded-full h-[30px] w-[30px] border-b-2 border-blue-500" />
            <span>Working On Identifying Friends...</span>
          </div>
        ) : faces.length === 0 ? (
          <p className="text-gray-500 text-sm">No faces detected</p>
        ) : (
          <div className="flex gap-3 overflow-x-auto pb-1 justify-center">
            {faces.map((face, i) => {
              const colors = STATUS_COLORS[face.status] || STATUS_COLORS.unknown;
              const a = face.attributes || {};
              const tooltipParts = [
                face.friendName ? `Name: ${face.friendName}` : 'Unrecognized',
                a.ageRange  ? `Age: ${a.ageRange}`  : null,
                a.gender    ? `Gender: ${a.gender}`  : null,
                a.emotion   ? `Mood: ${a.emotion}`   : null,
                a.eyeglasses ? 'Eyeglasses' : null,
                a.sunglasses ? 'Sunglasses' : null,
                a.beard      ? 'Beard'      : null,
                a.smile      ? 'Smiling'    : null,
                face.note   ? `Note: ${face.note}`  : null,
              ].filter(Boolean).join(' · ');
              return (
                <button
                  key={face.faceId}
                  onClick={() => handleFaceClick(face, i)}
                  title={tooltipParts}
                  className={`flex-shrink-0 flex flex-col items-center gap-1 p-1 rounded-lg transition-colors ${
                    selectedFaceIndex === i ? 'bg-gray-700' : 'hover:bg-gray-700'
                  }`}
                >
                  <div
                    className="w-[72px] h-[72px] rounded-full bg-gray-700 border-2 overflow-hidden flex items-center justify-center"
                    style={{ borderColor: colors.border }}
                  >
                    {face.thumbnailUrl
                      ? <img src={face.thumbnailUrl} alt="" className="w-full h-full object-cover" />
                      : <span className="text-gray-500 text-[30px]">👤</span>
                    }
                  </div>
                  <span className="text-white text-sm max-w-[90px] truncate text-center">
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
          <BackIcon className="w-6 h-6" />
          <span>Back</span>
        </button>

        {photoDataUrl ? (
          <div className="relative w-full max-w-3xl">
            <canvas
              ref={canvasRef}
              className="w-full rounded-xl"
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
          capturedPhotoUrl={activeFace.thumbnailUrl}
          onClose={() => setShowFriendForm(false)}
          onSave={(saved) => {
            if (!saved || !activeFace) return;
            setFaces(prev => {
              const updated = prev.map(f =>
                f.faceId === activeFace.faceId
                  ? { ...f, status: 'known', friendName: saved.name, friendId: saved.friendId }
                  : f
              );
              if (imgRef.current) drawBoundingBoxes(updated, imgRef.current);
              return updated;
            });
          }}
        />
      )}
    </div>
  );
}
