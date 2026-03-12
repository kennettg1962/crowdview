import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import AppHeader from '../components/AppHeader';
import NavBar from '../components/NavBar';
import TrueFooter from '../components/TrueFooter';
import FriendFormPopup from '../components/FriendFormPopup';
import AddPhotoToFriendPopup from '../components/AddPhotoToFriendPopup';
import { MovieCameraIcon, FriendsIcon, BackIcon } from '../components/Icons';
import useVoiceCommands from '../hooks/useVoiceCommands';
import api from '../api/api';

const STATUS_COLORS = {
  known:      { border: '#22c55e' },
  identified: { border: '#f97316' },
  unknown:    { border: '#ef4444' },
};

function cropFace(photoDataUrl, box) {
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
    img.src = photoDataUrl;
  });
}

export default function IdScreen() {
  const navigate = useNavigate();
  const location = useLocation();
  const [faces, setFaces] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedFaceIndex, setSelectedFaceIndex] = useState(0);
  const [hoveredFaceIndex, setHoveredFaceIndex] = useState(null);
  const [showFriendForm, setShowFriendForm] = useState(false);
  const [activeFace, setActiveFace] = useState(null);
  const [activeFaceCrop, setActiveFaceCrop] = useState(null);
  const [contextMenu, setContextMenu] = useState(null); // { x, y, face, index }
  const [showAddPhotoPopup, setShowAddPhotoPopup] = useState(null); // { face, faceCrop }
  const photoDataUrl = location.state?.photoDataUrl;

  const handlePrev = useCallback(() => {
    setSelectedFaceIndex(i => Math.max(0, i - 1));
  }, []);

  const handleNext = useCallback(() => {
    setSelectedFaceIndex(i => Math.min(faces.length - 1, i + 1));
  }, [faces.length]);

  const handleShow = useCallback(() => {
    if (faces[selectedFaceIndex]) {
      openFaceForm(faces[selectedFaceIndex]);
    }
  }, [faces, selectedFaceIndex]); // eslint-disable-line react-hooks/exhaustive-deps

  useVoiceCommands({
    screen: 'id',
    commands: { prev: handlePrev, next: handleNext, show: handleShow }
  });

  useEffect(() => {
    if (photoDataUrl) identifyFaces();
  }, [photoDataUrl]); // eslint-disable-line react-hooks/exhaustive-deps

  async function identifyFaces() {
    setLoading(true);
    try {
      const res = await api.post('/api/rekognition/identify', { imageData: photoDataUrl });
      setFaces(res.data.faces || []);
    } catch (err) {
      console.error('Identification failed', err);
      setFaces([]);
    } finally {
      setLoading(false);
    }
  }

  async function openFaceForm(face) {
    const cropped = await cropFace(photoDataUrl, face.boundingBox);
    setActiveFace(face);
    setActiveFaceCrop(cropped);
    setShowFriendForm(true);
  }

  function handleFaceClick(face, index) {
    setSelectedFaceIndex(index);
    openFaceForm(face);
  }

  async function handleFaceRightClick(e, face, index) {
    if (face.status !== 'unknown') return;
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({ x: e.clientX, y: e.clientY, face, index });
  }

  async function handleAddPhotoToFriend() {
    const { face } = contextMenu;
    setContextMenu(null);
    const cropped = await cropFace(photoDataUrl, face.boundingBox);
    setShowAddPhotoPopup({ face, faceCrop: cropped });
  }

  function buildTooltip(face) {
    const a = face.attributes || {};
    const attrs = [
      face.friendGroup ? `Group: ${face.friendGroup}` : null,
      a.ageRange   ? `Age: ${a.ageRange}`   : null,
      a.gender     ? a.gender               : null,
      a.emotion    ? a.emotion              : null,
      a.mask       ? 'Wearing mask'         : null,
      a.eyeglasses ? 'Eyeglasses'           : null,
      a.sunglasses ? 'Sunglasses'           : null,
      a.beard      ? 'Beard'                : null,
      a.smile      ? 'Smiling'              : null,
      face.note    ? `Note: ${face.note}`   : null,
    ].filter(Boolean);
    return attrs;
  }

  return (
    <div className="h-screen bg-gray-900 flex flex-col overflow-hidden">
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

      {/* Main: photo with bounding box overlays */}
      <main className="flex-1 flex flex-col items-center px-3 py-1.5 gap-1 overflow-hidden min-h-0">

        {/* Summary row: Back button left, message centered */}
        <div className="w-full flex items-center">
          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-1 px-3 py-1.5 bg-gray-800 hover:bg-gray-700 text-white rounded-lg text-sm flex-shrink-0"
          >
            <BackIcon className="w-6 h-6" />
            <span>Back</span>
          </button>

          <div className="flex-1 flex justify-center">
            {!loading && faces.length > 0 && (
              <div className="flex items-center gap-2 px-3 py-1.5 bg-gray-800 rounded-lg text-sm flex-wrap justify-center">
                <span className="text-white font-semibold">Identify Friends</span>
                <span className="text-gray-600">·</span>
                <span className="text-gray-300 font-medium">{faces.length} face{faces.length !== 1 ? 's' : ''} found</span>
                <span className="text-gray-600">·</span>
                <span className="text-green-400">{faces.filter(f => f.status === 'known').length} friend{faces.filter(f => f.status === 'known').length !== 1 ? 's' : ''}</span>
                <span className="text-gray-600">·</span>
                <span className="text-orange-400">{faces.filter(f => f.status === 'identified').length} identified</span>
                <span className="text-gray-600">·</span>
                <span className="text-red-400">{faces.filter(f => f.status === 'unknown').length} unknown</span>
              </div>
            )}
            {!loading && faces.length === 0 && (
              <span className="px-3 py-1.5 bg-gray-800 rounded-lg text-sm text-gray-400">No faces detected</span>
            )}
          </div>

          {/* Right spacer to balance the Back button */}
          <div className="flex-shrink-0" style={{ width: '72px' }} />
        </div>

        {photoDataUrl ? (
          <div className="flex-1 min-h-0 flex items-center justify-center w-full overflow-hidden">
          <div className="h-full bg-white p-3 flex items-center justify-center">
          <div className="relative h-full overflow-hidden">
            <img
              src={photoDataUrl}
              alt="Captured"
              className="h-full w-auto max-w-full block"
              draggable={false}
            />

            {/* Loading overlay */}
            {loading && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/50 rounded-xl gap-3">
                <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-400" />
                <p className="text-white text-sm font-medium">Identifying faces...</p>
              </div>
            )}

            {/* Face bounding box overlays */}
            {!loading && (() => {
              let unknownCount = 0;
              const unknownLabels = faces.reduce((acc, f, i) => {
                if (f.status === 'unknown') acc[i] = ++unknownCount;
                return acc;
              }, {});
              return faces.map((face, i) => {
              const { left, top, width, height } = face.boundingBox;
              const color = STATUS_COLORS[face.status]?.border || '#ffffff';
              const isHovered = hoveredFaceIndex === i;
              const tooltipAttrs = buildTooltip(face);
              // Show tooltip above face if face is in lower 40% of image, else below
              const tooltipAbove = top > 0.45;

              return (
                <button
                  key={face.faceId || i}
                  onMouseEnter={() => setHoveredFaceIndex(i)}
                  onMouseLeave={() => setHoveredFaceIndex(null)}
                  onClick={() => { setContextMenu(null); handleFaceClick(face, i); }}
                  onContextMenu={e => handleFaceRightClick(e, face, i)}
                  title={face.friendName || 'Unknown — click to add as friend'}
                  style={{
                    position: 'absolute',
                    left:   `${left   * 100}%`,
                    top:    `${top    * 100}%`,
                    width:  `${width  * 100}%`,
                    height: `${height * 100}%`,
                    borderColor: color,
                    borderWidth: 2,
                    borderStyle: 'solid',
                  }}
                  className="rounded cursor-pointer hover:bg-white/10 transition-colors"
                >
                  {/* Name label at bottom of box */}
                  <span className={`absolute bottom-0 left-0 right-0 text-center text-xs px-1 py-0.5 truncate ${
                    face.status === 'known'
                      ? 'bg-green-700/80 text-green-100'
                      : face.status === 'identified'
                      ? 'bg-orange-700/80 text-orange-100'
                      : 'bg-red-700/80 text-red-100'
                  }`}>
                    {face.friendName || `Unknown ${unknownLabels[i]}`}
                  </span>

                  {/* Hover tooltip */}
                  {isHovered && (
                    <div
                      className="absolute z-20 bg-gray-900/95 text-white text-xs rounded-lg px-3 py-2 shadow-2xl pointer-events-none min-w-max"
                      style={tooltipAbove
                        ? { bottom: 'calc(100% + 6px)', left: '50%', transform: 'translateX(-50%)' }
                        : { top:    'calc(100% + 6px)', left: '50%', transform: 'translateX(-50%)' }
                      }
                    >
                      <p
                        className="font-semibold mb-1"
                        style={{ color }}
                      >
                        {face.friendName || `Unknown ${unknownLabels[i]}`}
                      </p>
                      {tooltipAttrs.map((attr, j) => (
                        <p key={j} className="text-gray-300">{attr}</p>
                      ))}
                      <p className="text-gray-500 mt-1 italic">
                        {face.status === 'known' ? 'Click to view / edit' : face.status === 'unknown' ? 'Click to add · Right-click to assign to existing friend' : 'Click to view'}
                      </p>
                    </div>
                  )}
                </button>
              );
            });
            })()}

          </div>
          </div>
          </div>
        ) : (
          <div className="text-gray-500 text-center">
            <p>No photo to display</p>
            <button onClick={() => navigate(-1)} className="text-blue-400 hover:text-blue-300 mt-2 underline text-sm">
              Return to Hub
            </button>
          </div>
        )}
      </main>

      <NavBar />
      <TrueFooter />

      {/* Right-click context menu */}
      {contextMenu && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setContextMenu(null)} />
          <div
            className="fixed z-50 bg-gray-800 border border-gray-700 rounded-lg shadow-2xl py-1 min-w-max"
            style={{ top: contextMenu.y, left: contextMenu.x }}
          >
            <button
              onClick={handleAddPhotoToFriend}
              className="w-full px-4 py-2 text-sm text-white hover:bg-gray-700 text-left"
            >
              Add photo to existing friend
            </button>
          </div>
        </>
      )}

      {showAddPhotoPopup && (
        <AddPhotoToFriendPopup
          faceCrop={showAddPhotoPopup.faceCrop}
          onClose={() => setShowAddPhotoPopup(null)}
          onSave={(saved) => {
            const face = showAddPhotoPopup.face;
            setFaces(prev => prev.map(f =>
              f.faceId === face.faceId
                ? { ...f, status: 'known', friendName: saved.name, friendId: saved.friendId, friendGroup: saved.group }
                : f
            ));
          }}
        />
      )}

      {showFriendForm && activeFace && (
        <FriendFormPopup
          friend={activeFace.friendId ? { Friend_Id: activeFace.friendId, Name_Txt: activeFace.friendName } : null}
          capturedPhotoUrl={activeFaceCrop}
          onClose={() => { setShowFriendForm(false); setActiveFaceCrop(null); }}
          onSave={(saved) => {
            if (!saved || !activeFace) return;
            setFaces(prev => prev.map(f =>
              f.faceId === activeFace.faceId
                ? { ...f, status: 'known', friendName: saved.name, friendId: saved.friendId }
                : f
            ));
          }}
        />
      )}
    </div>
  );
}
