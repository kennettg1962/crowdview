import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import AppHeader from '../components/AppHeader';
import NavBar from '../components/NavBar';
import TrueFooter from '../components/TrueFooter';
import AuthImage from '../components/AuthImage';
import FacePickerPopup from '../components/FacePickerPopup';
import { HomeIcon, PlusIcon, DeleteIcon, UploadIcon, XIcon } from '../components/Icons';
import api from '../api/api';

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
const EMPTY_FORM = { employeeName: '', loginCode: '', password: '' };

function readAndResize(file) {
  return new Promise(resolve => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const img = new Image();
      img.onload = () => {
        const maxW = 1280;
        const scale = Math.min(1, maxW / img.naturalWidth);
        const canvas = document.createElement('canvas');
        canvas.width  = Math.round(img.naturalWidth  * scale);
        canvas.height = Math.round(img.naturalHeight * scale);
        canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/jpeg', 0.82));
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

export default function EmployeesScreen() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('dashboard');

  const [employees, setEmployees]   = useState([]);
  const [empLoading, setEmpLoading] = useState(true);

  const [dashData, setDashData]       = useState([]);
  const [dashLoading, setDashLoading] = useState(true);

  // Form state
  const [showForm, setShowForm]         = useState(false);
  const [editEmployee, setEditEmployee] = useState(null);
  const [form, setForm]                 = useState(EMPTY_FORM);
  const [formError, setFormError]       = useState('');
  const [saving, setSaving]             = useState(false);

  // Photo wallet (form)
  const [photos, setPhotos]               = useState([]);
  const [photoIndex, setPhotoIndex]       = useState(0);
  const [photoUploading, setPhotoUploading] = useState(false);
  const photoInputRef = useRef(null);

  // Face-picker flow (new employee)
  const addPhotoInputRef                    = useRef(null);
  const [showFacePicker, setShowFacePicker] = useState(false);
  const [pickerImageUrl, setPickerImageUrl] = useState(null);
  const [pickerFaces, setPickerFaces]       = useState([]);
  const [pickerLoading, setPickerLoading]   = useState(false);
  const [pendingFaceCrop, setPendingFaceCrop] = useState(null);

  // Delete confirmation
  const [deletingEmployee, setDeletingEmployee] = useState(null);

  // Reset password
  const [resetPwEmployee, setResetPwEmployee] = useState(null);
  const [newPassword, setNewPassword]         = useState('');
  const [resetError, setResetError]           = useState('');
  const [resetSaving, setResetSaving]         = useState(false);

  // Drilldown
  const [drilldownEmp, setDrilldownEmp]         = useState(null);
  const [drilldownDates, setDrilldownDates]     = useState([]);
  const [drilldownLoading, setDrilldownLoading] = useState(false);

  // ── Data fetching ──────────────────────────────────────────────────────────

  const loadEmployees = useCallback(async () => {
    setEmpLoading(true);
    try { const res = await api.get('/api/corporate/employees'); setEmployees(res.data); }
    catch (err) { console.error(err); }
    finally { setEmpLoading(false); }
  }, []);

  const loadDashboard = useCallback(async () => {
    setDashLoading(true);
    try { const res = await api.get('/api/corporate/employees/dashboard'); setDashData(res.data); }
    catch (err) { console.error(err); }
    finally { setDashLoading(false); }
  }, []);

  useEffect(() => { loadEmployees(); loadDashboard(); }, [loadEmployees, loadDashboard]);

  async function loadPhotos(employeeId) {
    try {
      const res = await api.get(`/api/corporate/employees/${employeeId}/photos`);
      setPhotos(res.data);
      setPhotoIndex(0);
    } catch (err) { console.error(err); }
  }

  // ── Add-new flow: file → face picker → form ────────────────────────────────

  function openCreate() { addPhotoInputRef.current?.click(); }

  async function handleAddPhotoSelected(e) {
    const file = e.target.files[0];
    e.target.value = '';
    if (!file) return;
    const imageDataUrl = await readAndResize(file);
    setPickerImageUrl(imageDataUrl);
    setPickerFaces([]);
    setPickerLoading(true);
    setShowFacePicker(true);
    try {
      const res = await api.post('/api/rekognition/identify', { imageData: imageDataUrl });
      setPickerFaces(res.data.faces || []);
    } catch (err) { console.error('Face detection failed:', err); setPickerFaces([]); }
    finally { setPickerLoading(false); }
  }

  function handleFaceSelected(croppedDataUrl) {
    setPendingFaceCrop(croppedDataUrl);
    setShowFacePicker(false);
    setEditEmployee(null);
    setForm(EMPTY_FORM);
    setFormError('');
    setPhotos([]);
    setPhotoIndex(0);
    setShowForm(true);
  }

  function cancelFacePicker() { setShowFacePicker(false); setPickerImageUrl(null); setPickerFaces([]); }

  // ── Edit flow ──────────────────────────────────────────────────────────────

  function openEdit(emp) {
    setEditEmployee(emp);
    setForm({ employeeName: emp.Employee_Nm, loginCode: emp.Login_Cd, password: '' });
    setFormError('');
    setPendingFaceCrop(null);
    loadPhotos(emp.Organization_Employee_Id);
    setShowForm(true);
  }

  // ── Form submit ────────────────────────────────────────────────────────────

  async function handleSubmit(e) {
    e.preventDefault();
    setFormError('');
    setSaving(true);
    try {
      if (editEmployee) {
        await api.put(`/api/corporate/employees/${editEmployee.Organization_Employee_Id}`, form);
      } else {
        const res = await api.post('/api/corporate/employees', form);
        const { employeeId } = res.data;
        if (pendingFaceCrop) {
          const blob = await fetch(pendingFaceCrop).then(r => r.blob());
          const fd = new FormData();
          fd.append('photo', blob, 'face.jpg');
          await api.post(`/api/corporate/employees/${employeeId}/photos`, fd,
            { headers: { 'Content-Type': 'multipart/form-data' } });
          setPendingFaceCrop(null);
        }
      }
      await loadEmployees();
      await loadDashboard();
      setShowForm(false);
    } catch (err) {
      setFormError(err.response?.data?.error || 'Save failed');
    } finally { setSaving(false); }
  }

  // ── Photo management (form wallet) ─────────────────────────────────────────

  async function handlePhotoUpload(e) {
    const file = e.target.files[0];
    if (!file || !editEmployee) return;
    setPhotoUploading(true);
    try {
      const fd = new FormData();
      fd.append('photo', file);
      await api.post(`/api/corporate/employees/${editEmployee.Organization_Employee_Id}/photos`, fd,
        { headers: { 'Content-Type': 'multipart/form-data' } });
      await loadPhotos(editEmployee.Organization_Employee_Id);
      setPhotoIndex(photos.length); // jump to newly uploaded photo
    } catch (err) { console.error('Upload failed:', err); }
    finally { setPhotoUploading(false); e.target.value = ''; }
  }

  async function handleDeleteCurrentPhoto() {
    if (!editEmployee || photos.length === 0) return;
    const ph = photos[photoIndex];
    try {
      await api.delete(`/api/corporate/employees/${editEmployee.Organization_Employee_Id}/photos/${ph.Organization_Employee_Photo_Id}`);
      await loadPhotos(editEmployee.Organization_Employee_Id);
      setPhotoIndex(idx => Math.max(0, idx - 1));
    } catch (err) { console.error(err); }
  }

  // ── Delete employee ────────────────────────────────────────────────────────

  async function confirmDelete() {
    if (!deletingEmployee) return;
    try {
      await api.delete(`/api/corporate/employees/${deletingEmployee.Organization_Employee_Id}`);
      setDeletingEmployee(null);
      loadEmployees(); loadDashboard();
    } catch (err) { console.error(err); }
  }

  // ── Reset password ─────────────────────────────────────────────────────────

  async function handleResetPassword(e) {
    e.preventDefault();
    setResetError(''); setResetSaving(true);
    try {
      await api.post(`/api/corporate/employees/${resetPwEmployee.Organization_Employee_Id}/reset-password`, { newPassword });
      setResetPwEmployee(null); setNewPassword('');
    } catch (err) { setResetError(err.response?.data?.error || 'Reset failed'); }
    finally { setResetSaving(false); }
  }

  // ── Drilldown ──────────────────────────────────────────────────────────────

  async function openDrilldown(emp) {
    setDrilldownEmp(emp); setDrilldownLoading(true);
    try {
      const res = await api.get(`/api/corporate/employees/${emp.employeeId}/attendance`);
      setDrilldownDates(res.data);
    } catch (err) { console.error(err); }
    finally { setDrilldownLoading(false); }
  }

  // ── A-Z grouping ───────────────────────────────────────────────────────────

  const grouped = ALPHABET.reduce((acc, letter) => {
    const matches = employees.filter(e => (e.Employee_Nm || '').toUpperCase().startsWith(letter));
    if (matches.length) acc[letter] = matches;
    return acc;
  }, {});

  function scrollToLetter(letter) {
    const el = document.getElementById(`el-${letter}`);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  // ── Current photo URL in wallet ────────────────────────────────────────────
  const walletPhotoUrl = editEmployee && photos[photoIndex]
    ? `/api/corporate/employees/${editEmployee.Organization_Employee_Id}/photos/${photos[photoIndex].Organization_Employee_Photo_Id}/data`
    : (!editEmployee && pendingFaceCrop) ? pendingFaceCrop
    : null;

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="bg-slate-700 min-h-screen flex flex-col">
      <input ref={addPhotoInputRef} type="file" accept="image/*" className="hidden" onChange={handleAddPhotoSelected} />

      <AppHeader
        left={
          <button onClick={() => navigate('/hub')} className="text-gray-300 hover:text-white p-2 rounded-lg hover:bg-gray-700">
            <HomeIcon className="w-[30px] h-[30px]" />
          </button>
        }
        center={<span className="text-white font-bold text-xl tracking-wide text-center leading-tight"><div>CrowdView</div><div>Corporate</div></span>}
        right={
          activeTab === 'employees' ? (
            <button onClick={openCreate} className="text-gray-300 hover:text-white p-2 rounded-lg hover:bg-gray-700">
              <PlusIcon className="w-[30px] h-[30px]" />
            </button>
          ) : <div className="w-[46px]" />
        }
      />

      {/* Tab bar */}
      <div className="flex border-b border-gray-700 bg-gray-800">
        {[{ label: 'Dashboard', id: 'dashboard' }, { label: 'Employees', id: 'employees' }].map(t => (
          <button key={t.id} onClick={() => setActiveTab(t.id)}
            className={`flex-1 py-2.5 text-sm font-medium transition-colors
              ${activeTab === t.id ? 'text-blue-400 border-b-2 border-blue-400' : 'text-gray-400 hover:text-gray-200'}`}>
            {t.label}
          </button>
        ))}
      </div>

      <main className="flex-1 flex flex-col items-center px-4 py-4 pb-32">

        {/* ── DASHBOARD TAB ── */}
        {activeTab === 'dashboard' && (
          <div className="w-full max-w-2xl">
            {dashLoading ? (
              <div className="flex justify-center mt-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" /></div>
            ) : dashData.length === 0 ? (
              <p className="text-center text-gray-500 mt-12 text-sm">No employees yet</p>
            ) : (
              <div className="bg-gray-900 rounded-lg overflow-hidden">
                <div className="grid grid-cols-4 gap-2 px-4 py-2 bg-gray-800 border-b border-gray-700">
                  <span className="text-xs font-semibold text-gray-400 col-span-1">Employee</span>
                  <span className="text-xs font-semibold text-gray-400 text-center">Week</span>
                  <span className="text-xs font-semibold text-gray-400 text-center">Month</span>
                  <span className="text-xs font-semibold text-gray-400 text-center">Year</span>
                </div>
                <div className="divide-y divide-gray-800">
                  {dashData.map(emp => (
                    <button key={emp.employeeId} onClick={() => openDrilldown(emp)}
                      className="w-full grid grid-cols-4 gap-2 px-4 py-3 hover:bg-gray-800 transition-colors text-left">
                      <div className="col-span-1 min-w-0">
                        <p className="text-sm font-medium text-white truncate">{emp.employeeName}</p>
                        <p className="text-xs text-gray-500 truncate">{emp.loginCode}</p>
                      </div>
                      <span className={`text-sm font-semibold text-center self-center ${emp.weekCount > 0 ? 'text-green-400' : 'text-gray-600'}`}>{emp.weekCount}</span>
                      <span className={`text-sm font-semibold text-center self-center ${emp.monthCount > 0 ? 'text-blue-400' : 'text-gray-600'}`}>{emp.monthCount}</span>
                      <span className={`text-sm font-semibold text-center self-center ${emp.yearCount > 0 ? 'text-purple-400' : 'text-gray-600'}`}>{emp.yearCount}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── EMPLOYEES TAB ── */}
        {activeTab === 'employees' && (
          <div className="w-full max-w-2xl">
            {empLoading ? (
              <div className="flex justify-center mt-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" /></div>
            ) : employees.length === 0 ? (
              <div className="flex flex-col items-center justify-center mt-12 gap-3 text-gray-500">
                <p className="text-sm">No employees yet</p>
                <button onClick={openCreate} className="text-blue-400 hover:text-blue-300 text-sm underline">Add your first employee</button>
              </div>
            ) : (
              <div className="flex gap-2">
                {/* A-Z index */}
                <div className="flex flex-col gap-0.5 py-1 text-xs text-gray-500">
                  {ALPHABET.map(letter => (
                    <button key={letter} onClick={() => scrollToLetter(letter)}
                      className={`hover:text-white leading-none ${grouped[letter] ? 'text-gray-300' : ''}`}>
                      {letter}
                    </button>
                  ))}
                </div>

                {/* Employee list */}
                <div className="flex-1 space-y-1 bg-gray-900 rounded-lg overflow-hidden">
                  {Object.entries(grouped).map(([letter, letterEmps]) => (
                    <div key={letter} id={`el-${letter}`}>
                      <div className="bg-gray-900 text-blue-400 text-xs font-bold px-2 py-1">{letter}</div>
                      {letterEmps.map(emp => (
                        <div key={emp.Organization_Employee_Id} className="flex items-center gap-1 hover:bg-gray-800 transition-colors">
                          <button onClick={() => openEdit(emp)} className="flex-1 flex items-center gap-3 p-3 text-left">
                            {/* Photo thumbnail */}
                            <div className="w-[52px] h-[52px] rounded-full bg-gray-700 overflow-hidden flex-shrink-0 flex items-center justify-center border border-gray-600">
                              <AuthImage
                                src={`/api/corporate/employees/${emp.Organization_Employee_Id}/photos/primary/data`}
                                alt={emp.Employee_Nm}
                                className="w-full h-full object-cover"
                                fallback={<span className="text-gray-500 text-xl">👤</span>}
                                lazy
                              />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-white text-sm font-medium truncate">{emp.Employee_Nm}</p>
                              <p className="text-gray-500 text-xs truncate">
                                {emp.Login_Cd}
                                {Number(emp.Photo_Count) > 0 && (
                                  <span className="ml-2 text-blue-400">{emp.Photo_Count} photo{Number(emp.Photo_Count) !== 1 ? 's' : ''}</span>
                                )}
                              </p>
                            </div>
                            <span className="text-gray-600">›</span>
                          </button>
                          <button onClick={() => setDeletingEmployee(emp)}
                            className="p-3 text-red-400/50 hover:text-red-400 transition-colors flex-shrink-0">
                            <DeleteIcon className="w-5 h-5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </main>

      <TrueFooter />
      <NavBar />

      {/* ── FACE PICKER ── */}
      {showFacePicker && pickerImageUrl && (
        <FacePickerPopup
          imageDataUrl={pickerImageUrl}
          faces={pickerFaces}
          loading={pickerLoading}
          actionLabel="add as an employee"
          onSelectFace={handleFaceSelected}
          onCancel={cancelFacePicker}
        />
      )}

      {/* ── EMPLOYEE FORM MODAL ── */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 px-4">
          <div className="w-full max-w-lg bg-gray-800 rounded-t-2xl sm:rounded-2xl flex flex-col max-h-[90vh]">

            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-700 flex-shrink-0">
              <h2 className="text-base font-semibold text-white">
                {editEmployee ? 'Edit Employee' : 'Add Employee'}
              </h2>
              <button onClick={() => setShowForm(false)} className="text-gray-400 hover:text-white">
                <XIcon className="w-5 h-5" />
              </button>
            </div>

            {/* Scrollable body */}
            <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-5 space-y-4">

              {/* ── Photo wallet ── */}
              <div className="flex flex-col items-center gap-2">
                <div className="w-32 h-32 rounded-lg bg-gray-700 overflow-hidden border-2 border-gray-600 flex items-center justify-center">
                  {walletPhotoUrl ? (
                    <AuthImage src={walletPhotoUrl} alt="Employee" className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-gray-500 text-5xl">👤</span>
                  )}
                </div>

                {/* Multi-photo navigation (edit only) */}
                {editEmployee && photos.length > 1 && (
                  <div className="flex items-center gap-3 text-sm text-gray-400">
                    <button type="button" onClick={() => setPhotoIndex(i => Math.max(0, i - 1))}
                      disabled={photoIndex === 0} className="disabled:opacity-40 hover:text-white">◀</button>
                    <span>{photoIndex + 1} / {photos.length}</span>
                    <button type="button" onClick={() => setPhotoIndex(i => Math.min(photos.length - 1, i + 1))}
                      disabled={photoIndex === photos.length - 1} className="disabled:opacity-40 hover:text-white">▶</button>
                  </div>
                )}

                <div className="flex gap-2">
                  {/* Upload — edit only */}
                  {editEmployee && (
                    <>
                      <input ref={photoInputRef} type="file" accept="image/*" className="hidden" onChange={handlePhotoUpload} />
                      <button type="button" onClick={() => photoInputRef.current?.click()} disabled={photoUploading}
                        className="flex items-center gap-1 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-lg text-sm">
                        <UploadIcon className="w-4 h-4" /> {photoUploading ? 'Uploading…' : 'Upload'}
                      </button>
                    </>
                  )}
                  {/* Remove current photo */}
                  {walletPhotoUrl && (
                    <button type="button"
                      onClick={editEmployee ? handleDeleteCurrentPhoto : () => setPendingFaceCrop(null)}
                      className="flex items-center gap-1 px-3 py-1.5 bg-red-600/20 hover:bg-red-600 text-red-400 hover:text-white rounded-lg text-sm transition-colors">
                      <XIcon className="w-4 h-4" /> Remove
                    </button>
                  )}
                </div>
              </div>

              {/* ── Fields ── */}
              <div>
                <label className="block text-xs text-gray-400 mb-1">Employee Name <span className="text-red-400">*</span></label>
                <input value={form.employeeName} onChange={e => setForm(f => ({ ...f, employeeName: e.target.value }))}
                  required
                  className="w-full bg-gray-700 text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Jane Smith" />
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">Login Code <span className="text-red-400">*</span></label>
                <input value={form.loginCode} onChange={e => setForm(f => ({ ...f, loginCode: e.target.value }))}
                  required
                  className="w-full bg-gray-700 text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="jsmith" />
              </div>
              {!editEmployee && (
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Password <span className="text-red-400">*</span></label>
                  <input type="password" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                    required minLength={6}
                    className="w-full bg-gray-700 text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Min 6 characters" />
                </div>
              )}

              {/* Reset password link (edit only) */}
              {editEmployee && (
                <div>
                  <button type="button"
                    onClick={() => { setResetPwEmployee(editEmployee); setNewPassword(''); setResetError(''); }}
                    className="text-xs text-amber-400 hover:text-amber-300 underline">
                    Reset Password
                  </button>
                </div>
              )}

              {formError && <p className="text-red-400 text-sm">{formError}</p>}
            </form>

            {/* Footer */}
            <div className="flex gap-3 px-5 py-4 border-t border-gray-700 flex-shrink-0">
              {editEmployee && (
                <button type="button" onClick={() => setDeletingEmployee(editEmployee)}
                  className="p-2.5 bg-red-600/20 hover:bg-red-600 text-red-400 hover:text-white rounded-lg transition-colors" title="Delete employee">
                  <DeleteIcon className="w-5 h-5" />
                </button>
              )}
              <button type="button" onClick={() => setShowForm(false)}
                className="flex-1 bg-gray-700 hover:bg-gray-600 text-white text-sm font-medium py-2.5 rounded-lg">
                Cancel
              </button>
              <button type="submit" form="empForm" disabled={saving}
                onClick={handleSubmit}
                className="flex-1 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-sm font-medium py-2.5 rounded-lg">
                {saving ? 'Saving…' : editEmployee ? 'Save Changes' : 'Create Employee'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── DELETE CONFIRMATION ── */}
      {deletingEmployee && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-[60]">
          <div className="bg-gray-800 rounded-lg p-6 max-w-sm w-full mx-4 shadow-2xl">
            <p className="text-white font-medium mb-1">Delete {deletingEmployee.Employee_Nm}?</p>
            <p className="text-gray-400 text-sm mb-4">This will permanently remove the employee, their photos, and all attendance records.</p>
            <div className="flex gap-3">
              <button onClick={() => setDeletingEmployee(null)} className="flex-1 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg text-sm">Cancel</button>
              <button onClick={confirmDelete} className="flex-1 py-2 bg-red-600 hover:bg-red-500 text-white rounded-lg text-sm">Delete</button>
            </div>
          </div>
        </div>
      )}

      {/* ── RESET PASSWORD ── */}
      {resetPwEmployee && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-[60]">
          <div className="bg-gray-800 rounded-lg p-6 max-w-sm w-full mx-4 shadow-2xl">
            <p className="text-white font-medium mb-3">Reset password for {resetPwEmployee.Employee_Nm}</p>
            <form onSubmit={handleResetPassword} className="space-y-3">
              <input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)}
                required minLength={6} placeholder="New password (min 6 chars)"
                className="w-full bg-gray-700 text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500" />
              {resetError && <p className="text-red-400 text-xs">{resetError}</p>}
              <div className="flex gap-3">
                <button type="button" onClick={() => setResetPwEmployee(null)} className="flex-1 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg text-sm">Cancel</button>
                <button type="submit" disabled={resetSaving} className="flex-1 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-lg text-sm">
                  {resetSaving ? 'Saving…' : 'Reset'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── ATTENDANCE DRILLDOWN ── */}
      {drilldownEmp && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 px-4">
          <div className="bg-gray-800 rounded-xl w-full max-w-sm shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-700">
              <div>
                <p className="text-white font-semibold text-sm">{drilldownEmp.employeeName}</p>
                <p className="text-gray-500 text-xs">Detection history</p>
              </div>
              <button onClick={() => setDrilldownEmp(null)} className="text-gray-400 hover:text-white">
                <XIcon className="w-5 h-5" />
              </button>
            </div>
            <div className="overflow-y-auto max-h-80 divide-y divide-gray-700">
              {drilldownLoading ? (
                <div className="flex justify-center py-8"><div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500" /></div>
              ) : drilldownDates.length === 0 ? (
                <p className="text-center text-gray-500 text-sm py-8">No detections recorded yet</p>
              ) : (
                drilldownDates.map((dt, i) => (
                  <div key={i} className="px-5 py-3">
                    <p className="text-white text-sm">{new Date(dt).toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
