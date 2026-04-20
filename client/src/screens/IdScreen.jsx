import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import AppHeader from '../components/AppHeader';
import NavBar from '../components/NavBar';
import TrueFooter from '../components/TrueFooter';
import FriendFormPopup from '../components/FriendFormPopup';
import AddPhotoToFriendPopup from '../components/AddPhotoToFriendPopup';
import { MovieCameraIcon, FriendsIcon, BackIcon, UserProfileIcon } from '../components/Icons';
import useVoiceCommands from '../hooks/useVoiceCommands';
import useGlassesPresentation from '../hooks/useGlassesPresentation';
import { useApp } from '../context/AppContext';
import api from '../api/api';

const STATUS_COLORS = {
  known:      { border: '#22c55e' },
  identified: { border: '#f97316' },
  employee:   { border: '#ffffff' },
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

function FaceTile({ face, crop, displayName, onOpen, onDismiss }) {
  const tierColor = face.tier?.color || null;
  const accentClass = tierColor ? ''
    : face.status === 'known'      ? 'border-green-500'
    : face.status === 'identified' ? 'border-orange-500'
    : face.status === 'employee'   ? 'border-white'
    :                                'border-red-500';
  return (
    <div
      className={`relative flex items-center gap-3 p-3 bg-gray-800 rounded-lg border-l-2 ${accentClass}`}
      style={tierColor ? { borderLeftColor: tierColor } : undefined}
    >
      <button
        onClick={onDismiss}
        title="Dismiss"
        className="absolute top-1 right-1 w-5 h-5 rounded-full bg-gray-700 hover:bg-gray-600 text-gray-400 hover:text-white flex items-center justify-center transition-colors"
      >
        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
      {crop && (
        <img src={crop} alt={displayName} className="w-14 h-14 rounded-lg object-cover flex-shrink-0 border border-gray-600" />
      )}
      <div className="flex-1 min-w-0 pr-2">
        <p className="text-sm font-semibold text-white truncate">{displayName}</p>
        {face.tier?.name && (
          <p className="text-xs font-medium mt-0.5 truncate" style={{ color: tierColor || '#9ca3af' }}>
            {face.tier.name}
          </p>
        )}
        {face.note && <p className="text-xs text-gray-400 line-clamp-2 mt-0.5">{face.note}</p>}
      </div>
      {face.friendId && (
        <button onClick={onOpen} title="View" className="flex-shrink-0 p-1.5 text-gray-400 hover:text-white transition-colors">
          <UserProfileIcon className="w-8 h-8" />
        </button>
      )}
    </div>
  );
}

export default function IdScreen() {
  const navigate = useNavigate();
  const location = useLocation();
  const { isCorporate } = useApp();
  const [faces, setFaces] = useState([]);
  const [loading, setLoading] = useState(true);
  const [identifyError, setIdentifyError] = useState(null);
  const [selectedFaceIndex, setSelectedFaceIndex] = useState(0);
  const [hoveredFaceIndex, setHoveredFaceIndex] = useState(null);
  const [showFriendForm, setShowFriendForm] = useState(false);
  const [activeFace, setActiveFace] = useState(null);
  const [activeFaceCrop, setActiveFaceCrop] = useState(null);
  const [contextMenu, setContextMenu] = useState(null); // { x, y, face, index }
  const [showAddPhotoPopup, setShowAddPhotoPopup] = useState(null); // { face, faceCrop }
  const [imgStyle, setImgStyle] = useState(null); // {width, height} in px for rendered image
  const [faceCrops, setFaceCrops] = useState({});   // index → dataUrl
  const [dismissedFaces, setDismissedFaces] = useState(new Set()); // dismissed tile indices
  const photoContainerRef = useRef(null);
  const photoDataUrl = location.state?.photoDataUrl;
  const saveToLibrary = location.state?.saveToLibrary ?? false;

  const handleShow = useCallback(() => {
    if (faces[selectedFaceIndex]) {
      openFaceForm(faces[selectedFaceIndex]);
    }
  }, [faces, selectedFaceIndex]); // eslint-disable-line react-hooks/exhaustive-deps

  const speakRef = useRef(null);
  const { speak } = useVoiceCommands({
    screen: 'id',
    commands: {
      prev:  () => setSelectedFaceIndex(i => { if (i === 0) { speakRef.current?.('First face'); return i; } return i - 1; }),
      next:  () => setSelectedFaceIndex(i => { if (i === faces.length - 1) { speakRef.current?.('Last face'); return i; } return i + 1; }),
      show:   handleShow,
      cancel: () => { setShowFriendForm(false); setActiveFaceCrop(null); },
      back:   () => navigate('/hub'),
    },
  });
  speakRef.current = speak;

  useGlassesPresentation(faces, photoDataUrl, selectedFaceIndex);

  useEffect(() => {
    if (photoDataUrl) identifyFaces();
  }, [photoDataUrl]); // eslint-disable-line react-hooks/exhaustive-deps

  // Crop each face for the tile panel when identification completes
  useEffect(() => {
    if (!faces.length || !photoDataUrl) return;
    setDismissedFaces(new Set());
    setFaceCrops({});
    faces.forEach((face, i) => {
      cropFace(photoDataUrl, face.boundingBox).then(crop => {
        setFaceCrops(prev => ({ ...prev, [i]: crop }));
      });
    });
  }, [faces]); // eslint-disable-line react-hooks/exhaustive-deps

  function calcImgStyle(img) {
    const container = photoContainerRef.current;
    if (!container || !img) return;
    const cw = container.clientWidth;
    const ch = container.clientHeight;
    if (!cw || !ch) return;
    const scale = Math.min(cw / img.naturalWidth, ch / img.naturalHeight);
    setImgStyle({
      width:  Math.round(img.naturalWidth  * scale),
      height: Math.round(img.naturalHeight * scale),
    });
  }

  useEffect(() => {
    const container = photoContainerRef.current;
    if (!container) return;
    const ro = new ResizeObserver(() => {
      const img = container.querySelector('img');
      if (img?.complete) calcImgStyle(img);
    });
    ro.observe(container);
    return () => ro.disconnect();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function identifyFaces() {
    setLoading(true);
    setIdentifyError(null);
    // Save photo to library only for fresh captures (not when re-viewing from Library)
    if (saveToLibrary) {
      fetch(photoDataUrl).then(r => r.blob()).then(blob => {
        const fd = new FormData();
        fd.append('media', blob, 'photo.jpg');
        api.post('/api/media', fd).catch(() => {});
      }).catch(() => {});
    }
    try {
      const res = await api.post('/api/rekognition/identify', { imageData: photoDataUrl, detectionType: 'id' });
      setFaces(res.data.faces || []);
    } catch (err) {
      console.error('Identification failed', err);
      setFaces([]);
      const status = err.response?.status;
      setIdentifyError(status === 500 ? 'Server error — identification failed. Please try again.' : 'Identification failed. Please check your connection and try again.');
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
      face.tier?.name ? `Tier: ${face.tier.name}` : null,
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

  // Derive unknown face labels once — used by both bounding boxes and tile panel
  const unknownLabels = (() => {
    let count = 0;
    return faces.reduce((acc, f, i) => {
      if (f.status === 'unknown') acc[i] = ++count;
      return acc;
    }, {});
  })();

  const visibleTiles = faces.filter((_, i) => !dismissedFaces.has(i));

  return (
    <div className="min-h-screen md:h-screen bg-slate-700 flex flex-col overflow-hidden">
      {/* Header */}
      <AppHeader
        left={
          <button onClick={() => navigate('/hub')} className="text-gray-300 hover:text-white p-2 rounded-lg hover:bg-gray-700">
            <MovieCameraIcon className="w-[30px] h-[30px]" />
          </button>
        }
        center={<span className="text-white font-bold text-xl tracking-wide text-center leading-tight">{isCorporate ? <><div>CrowdView</div><div>Corporate</div></> : 'CrowdView'}</span>}
        right={
          <button onClick={() => navigate('/friends')} className="text-gray-300 hover:text-white p-2 rounded-lg hover:bg-gray-700">
            <FriendsIcon className="w-[30px] h-[30px]" />
          </button>
        }
      />

      {/* Main: photo column + right tile panel */}
      <main className="flex-1 flex overflow-hidden min-h-0">

        {/* Left: photo + bounding boxes */}
        <div className="flex-1 flex flex-col overflow-hidden min-h-0">

          {/* Summary row: Back button left, message centered — desktop only */}
          <div className="hidden md:flex w-full items-center px-3 py-1.5">
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
                  <span className="text-gray-300 font-medium">{faces.length} face{faces.length !== 1 ? 's' : ''} found</span>
                  <span className="text-gray-600">·</span>
                  <span className="text-green-400">{faces.filter(f => f.status === 'known').length} {isCorporate ? 'customer' : 'friend'}{faces.filter(f => f.status === 'known').length !== 1 ? 's' : ''}</span>
                  <span className="text-gray-600">·</span>
                  <span className="text-red-400">{faces.filter(f => f.status === 'unknown').length} unknown</span>
                </div>
              )}
              {!loading && identifyError && (
                <div className="flex items-center gap-2 px-3 py-1.5 bg-red-900/50 border border-red-700 rounded-lg">
                  <span className="text-sm text-red-400">{identifyError}</span>
                  <button onClick={identifyFaces} className="text-sm text-white bg-red-700 hover:bg-red-600 px-2 py-0.5 rounded">Retry</button>
                </div>
              )}
              {!loading && !identifyError && faces.length === 0 && (
                <span className="px-3 py-1.5 bg-gray-800 rounded-lg text-sm text-gray-400">No faces detected</span>
              )}
            </div>

            <div className="flex-shrink-0" style={{ width: '72px' }} />
          </div>

          {/* Mobile: identification message above photo */}
          {photoDataUrl && (
            <div className="md:hidden w-full flex justify-center pointer-events-none px-3 py-1.5">
              {!loading && faces.length > 0 && (
                <div className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-800 rounded-lg text-xs whitespace-nowrap">
                  <span className="text-white font-semibold">{faces.length} face{faces.length !== 1 ? 's' : ''}</span>
                  <span className="text-white/40">·</span>
                  <span className="text-green-400">{faces.filter(f => f.status === 'known').length} {isCorporate ? 'customer' : 'friend'}{faces.filter(f => f.status === 'known').length !== 1 ? 's' : ''}</span>
                  <span className="text-white/40">·</span>
                  <span className="text-red-400">{faces.filter(f => f.status === 'unknown').length} unknown</span>
                </div>
              )}
              {!loading && identifyError && (
                <div className="px-3 py-1.5 bg-red-900/70 rounded-lg text-xs text-red-300">{identifyError}</div>
              )}
              {!loading && !identifyError && faces.length === 0 && (
                <div className="px-3 py-1.5 bg-gray-800 rounded-lg text-xs text-gray-400">No faces detected</div>
              )}
            </div>
          )}

          {photoDataUrl ? (
            <div ref={photoContainerRef} className="flex-1 min-h-0 flex items-center justify-center w-full bg-slate-700 overflow-hidden">

              {/* Wrapper sized exactly to rendered image — bounding boxes are % of this */}
              <div className="relative flex-shrink-0" style={imgStyle || { width: '100%', height: '100%' }}>
                <img
                  src={photoDataUrl}
                  alt="Captured"
                  className="block"
                  style={{ width: '100%', height: '100%' }}
                  draggable={false}
                  onLoad={e => calcImgStyle(e.target)}
                />

                {/* Floating Live shortcut — top-left corner of photo, all breakpoints */}
                <button
                  onClick={() => navigate('/hub')}
                  className="absolute top-3 left-3 z-20 flex items-center gap-1.5 px-2.5 py-1.5 bg-black/60 backdrop-blur-sm text-white rounded-lg text-sm font-medium hover:bg-black/80 transition-colors"
                >
                  <MovieCameraIcon className="w-4 h-4" />
                  <span>Live</span>
                </button>

                {/* Loading overlay */}
                {loading && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/50 rounded-xl gap-3">
                    <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-400" />
                    <p className="text-white text-sm font-medium">Identifying faces...</p>
                  </div>
                )}

                {/* Face bounding box overlays — percentage of image wrapper */}
                {!loading && imgStyle && faces.map((face, i) => {
                  const { left, top, width, height } = face.boundingBox;
                  const drawLeft   = Math.max(0, left   - width  * 0.05);
                  const drawTop    = Math.max(0, top    - height * 0.05);
                  const drawWidth  = Math.min(1 - drawLeft, width  * 1.1);
                  const drawHeight = Math.min(1 - drawTop,  height * 1.1);
                  const color = face.status === 'known' && face.tier?.color ? face.tier.color : (STATUS_COLORS[face.status]?.border || '#ffffff');
                  const isHovered = hoveredFaceIndex === i;
                  const tooltipAttrs = buildTooltip(face);
                  const tooltipAbove = top > 0.45;

                  return (
                    <button
                      key={face.faceId || i}
                      onMouseEnter={() => setHoveredFaceIndex(i)}
                      onMouseLeave={() => setHoveredFaceIndex(null)}
                      onClick={() => { setContextMenu(null); handleFaceClick(face, i); }}
                      onContextMenu={e => handleFaceRightClick(e, face, i)}
                      title={face.friendName || `Unknown — click to add as ${isCorporate ? 'customer' : 'friend'}`}
                      style={{
                        position: 'absolute',
                        left:   `${drawLeft   * 100}%`,
                        top:    `${drawTop    * 100}%`,
                        width:  `${drawWidth  * 100}%`,
                        height: `${drawHeight * 100}%`,
                        borderColor: color,
                        borderWidth: 2,
                        borderStyle: 'solid',
                      }}
                      className="rounded cursor-pointer hover:bg-white/10 transition-colors"
                    >
                      {/* Name label at bottom of box */}
                      <span
                        className="absolute bottom-0 left-0 right-0 text-center text-xs px-1 py-0.5 truncate text-white"
                        style={{ backgroundColor: color + 'cc' }}
                      >
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
                          <p className="font-semibold mb-1" style={{ color }}>
                            {face.friendName || `Unknown ${unknownLabels[i]}`}
                          </p>
                          {tooltipAttrs.map((attr, j) => (
                            <p key={j} className="text-gray-300">{attr}</p>
                          ))}
                          <p className="text-gray-500 mt-1 italic">
                            {face.status === 'known' ? 'Click to view / edit' : face.status === 'employee' ? 'Click to view' : face.status === 'unknown' ? `Click to add · Right-click to assign to existing ${isCorporate ? 'customer' : 'friend'}` : 'Click to view'}
                          </p>
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center text-gray-500 text-center">
              <div>
                <p>No photo to display</p>
                <button onClick={() => navigate(-1)} className="text-blue-400 hover:text-blue-300 mt-2 underline text-sm">
                  Return to Hub
                </button>
              </div>
            </div>
          )}

          {/* Mobile: horizontal tile strip */}
          {!loading && visibleTiles.length > 0 && (
            <div className="md:hidden flex-shrink-0 overflow-x-auto bg-gray-900 border-t border-gray-700"
                 style={{ scrollbarWidth: 'none' }}>
              <div className="flex gap-2 p-2">
                {faces.map((face, i) => (
                  !dismissedFaces.has(i) && (
                    <div key={face.faceId || i} className="flex-shrink-0 w-52">
                      <FaceTile
                        face={face}
                        crop={faceCrops[i]}
                        displayName={face.friendName || `Unknown ${unknownLabels[i]}`}
                        onOpen={() => handleFaceClick(face, i)}
                        onDismiss={() => setDismissedFaces(prev => new Set([...prev, i]))}
                      />
                    </div>
                  )
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right: face tile panel — desktop only */}
        <div className="hidden md:flex w-72 flex-shrink-0 flex-col bg-gray-900 border-l border-gray-700">
          <div className="px-3 py-2 border-b border-gray-700 flex-shrink-0">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
              {loading ? 'Identifying…' : `${faces.length} face${faces.length !== 1 ? 's' : ''} found`}
            </p>
          </div>
          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            {loading ? (
              <div className="flex flex-col items-center justify-center mt-8 gap-3">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-400" />
                <p className="text-gray-500 text-sm">Identifying faces...</p>
              </div>
            ) : faces.length === 0 ? (
              <p className="text-gray-500 text-sm text-center mt-8">No faces detected</p>
            ) : (
              faces.map((face, i) => (
                !dismissedFaces.has(i) && (
                  <FaceTile
                    key={face.faceId || i}
                    face={face}
                    crop={faceCrops[i]}
                    displayName={face.friendName || `Unknown ${unknownLabels[i]}`}
                    onOpen={() => handleFaceClick(face, i)}
                    onDismiss={() => setDismissedFaces(prev => new Set([...prev, i]))}
                  />
                )
              ))
            )}
          </div>
        </div>

      </main>

      <TrueFooter />
      <NavBar />

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
              Add photo to existing {isCorporate ? 'customer' : 'friend'}
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
                ? { ...f, status: 'known', friendName: saved.name, friendId: saved.friendId, friendGroup: saved.group, tier: saved.tier || null }
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
                ? { ...f, status: 'known', friendName: saved.name, friendId: saved.friendId, tier: saved.tier || null }
                : f
            ));
          }}
        />
      )}
    </div>
  );
}
