import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Html5QrcodeScanner } from 'html5-qrcode';

// --- Helper Components ---

const QrScannerModal = ({ show, onClose, onScanSuccess }) => {
    const scannerRef = useRef(null);

    useEffect(() => {
        if (show && !scannerRef.current) {
            const scanner = new Html5QrcodeScanner(
                'qr-reader', 
                { fps: 10, qrbox: { width: 250, height: 250 } },
                false // verbose
            );
            
            const handleSuccess = (decodedText, decodedResult) => {
                scanner.clear();
                onScanSuccess(decodedText);
            };

            const handleError = (error) => {
                // console.warn(`QR error = ${error}`);
            };

            scanner.render(handleSuccess, handleError);
            scannerRef.current = scanner;
        }

        return () => {
            if (scannerRef.current) {
                // scannerRef.current.clear().catch(error => console.error("Failed to clear scanner", error));
                scannerRef.current = null;
            }
        };
    }, [show, onScanSuccess]);

    if (!show) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex justify-center items-center z-50">
            <div className="bg-gray-800 p-6 rounded-lg shadow-xl w-full max-w-md border border-purple-500">
                <h3 className="text-lg font-medium leading-6 text-white mb-4">Scan QR Code</h3>
                <div id="qr-reader" style={{ width: '100%' }}></div>
                <div className="mt-4 text-right">
                    <button onClick={onClose} className="bg-red-600 text-white font-bold py-2 px-4 rounded-md hover:bg-red-700 transition duration-300">
                        Close
                    </button>
                </div>
            </div>
        </div>
    );
};

const SearchBar = ({ onSearch, searchFields, isLoading }) => {
  const [searchBy, setSearchBy] = useState(searchFields[0].value);
  const [searchTerm, setSearchTerm] = useState('');
  const [showQrScanner, setShowQrScanner] = useState(false);

  const handleSearch = () => {
    onSearch(searchBy, searchTerm);
  };

  const handleQrScanSuccess = (decodedText) => {
      setShowQrScanner(false);
      // Automatically set search criteria to Team ID and perform search
      setSearchBy('teamId');
      setSearchTerm(decodedText);
      onSearch('teamId', decodedText);
  };

  return (
    <>
      <QrScannerModal show={showQrScanner} onClose={() => setShowQrScanner(false)} onScanSuccess={handleQrScanSuccess} />
      <div className="bg-gray-800 bg-opacity-50 p-4 rounded-lg shadow-lg mb-6 border border-gray-700">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
          <div className="flex flex-col">
            <label htmlFor="searchBy" className="text-sm font-medium text-gray-300 mb-1">Search By</label>
            <select id="searchBy" value={searchBy} onChange={e => setSearchBy(e.target.value)} className="p-2 bg-gray-700 border border-gray-600 text-white rounded-md focus:ring-2 focus:ring-purple-500 focus:border-purple-500">
              {searchFields.map(field => <option key={field.value} value={field.value}>{field.label}</option>)}
            </select>
          </div>
          <div className="flex flex-col col-span-1">
            <label htmlFor="searchTerm" className="text-sm font-medium text-gray-300 mb-1">Search Term</label>
            <input id="searchTerm" type="text" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} placeholder="Enter search value..." className="p-2 bg-gray-700 border border-gray-600 text-white rounded-md focus:ring-2 focus:ring-purple-500 focus:border-purple-500" />
          </div>
          <button onClick={handleSearch} disabled={isLoading} className="bg-purple-600 text-white font-bold py-2 px-4 rounded-md hover:bg-purple-700 transition duration-300 w-full disabled:bg-purple-400 disabled:cursor-not-allowed">
            {isLoading ? 'Searching...' : 'Search'}
          </button>
          <button onClick={() => setShowQrScanner(true)} className="bg-gray-600 text-white font-bold py-2 px-4 rounded-md hover:bg-gray-700 transition duration-300 w-full flex items-center justify-center space-x-2">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h-1m-1 6v-1M4 12H3m1-6h1M6 5v1m12 12h1m-1-6h1m-6-1V3m-6 18v-1" /></svg>
            <span>Scan QR</span>
          </button>
        </div>
      </div>
    </>
  );
};

const LoadingSpinner = () => (
    <div className="flex justify-center items-center p-10">
        <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-purple-500"></div>
    </div>
);

const Notification = ({ message, type, onDismiss }) => {
    useEffect(() => {
        if (message) {
            const timer = setTimeout(() => {
                onDismiss();
            }, 3000);
            return () => clearTimeout(timer);
        }
    }, [message, onDismiss]);

    if (!message) return null;

    const baseClasses = "p-4 mb-4 rounded-lg shadow-lg text-white text-center";
    const typeClasses = type === 'success' ? 'bg-green-500' : 'bg-red-500';
    
    return (
        <div className={`${baseClasses} ${typeClasses}`}>
            {message}
        </div>
    );
};

// --- API Fetch with Timeout ---
const fetchWithTimeout = async (url, options = {}, timeout = 10000) => {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeout);

    const response = await fetch(url, {
        ...options,
        signal: controller.signal  
    });
    clearTimeout(id);
    return response;
};


// --- Main Views (Tabs) ---
const OnSpotRegView = ({ setNotification }) => {
  const [originalTeam, setOriginalTeam] = useState(null);
  const [modifiedTeam, setModifiedTeam] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const handleSearch = async (searchBy, searchTerm) => {
    if (!searchTerm.trim()) {
      setOriginalTeam(null);
      setModifiedTeam(null);
      return;
    }
    setIsLoading(true);
    try {
      const response = await fetchWithTimeout(`/api/teams/search/?by=${searchBy}&term=${searchTerm}`);
      if (!response.ok) throw new Error('Team not found');
      const data = await response.json();
      setOriginalTeam(data);
      setModifiedTeam(JSON.parse(JSON.stringify(data))); // Deep copy
    } catch (error) {
      const errorMessage = error.name === 'AbortError' ? 'Request timed out. Please check the backend server.' : error.message;
      setNotification({ message: errorMessage, type: 'error' });
      setOriginalTeam(null);
      setModifiedTeam(null);
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleCheckboxChange = (delegateId, field, value) => {
      const teamId = modifiedTeam.find(d => d.delegateId === delegateId).teamId;
      const isTeamUpdate = field === 'securityFeePaid';
      
      const updatedTeam = modifiedTeam.map(d => {
          if (isTeamUpdate ? d.teamId === teamId : d.delegateId === delegateId) {
              return { ...d, [field]: value };
          }
          return d;
      });
      setModifiedTeam(updatedTeam);
  };

  const handleSelectAll = (field, value) => {
    const updatedTeam = modifiedTeam.map(d => ({ ...d, [field]: value }));
    setModifiedTeam(updatedTeam);
  };

  const handleSaveChanges = async () => {
    setIsSaving(true);
    const changes = [];
    
    originalTeam.forEach(originalDelegate => {
        const modifiedDelegate = modifiedTeam.find(d => d.delegateId === originalDelegate.delegateId);
        ['waiverCollected', 'tagsCollected'].forEach(field => {
            if (originalDelegate[field] !== modifiedDelegate[field]) {
                changes.push({
                    endpoint: `/api/delegates/${modifiedDelegate.delegateId}/update_check/`,
                    payload: { [field]: modifiedDelegate[field] }
                });
            }
        });
    });

    if (originalTeam[0].securityFeePaid !== modifiedTeam[0].securityFeePaid) {
        changes.push({
            endpoint: `/api/teams/${modifiedTeam[0].teamId}/update_fee/`,
            payload: { securityFeePaid: modifiedTeam[0].securityFeePaid }
        });
    }

    try {
        await Promise.all(changes.map(change => 
            fetch(change.endpoint, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(change.payload)
            })
        ));
        setNotification({ message: 'Info updated successfully!', type: 'success' });
        setOriginalTeam(JSON.parse(JSON.stringify(modifiedTeam))); 
    } catch (error) {
        setNotification({ message: 'An error occurred while saving.', type: 'error' });
    } finally {
        setIsSaving(false);
    }
  };
  
  const isDirty = useMemo(() => JSON.stringify(originalTeam) !== JSON.stringify(modifiedTeam), [originalTeam, modifiedTeam]);
  const isSecurityFeePaid = useMemo(() => modifiedTeam?.[0]?.securityFeePaid || false, [modifiedTeam]);

  const areAllWaiversCollected = useMemo(() => modifiedTeam?.every(d => d.waiverCollected), [modifiedTeam]);
  const areAllTagsCollected = useMemo(() => modifiedTeam?.every(d => d.tagsCollected), [modifiedTeam]);

  return (
    <div>
      <SearchBar onSearch={handleSearch} isLoading={isLoading} searchFields={[
        { label: 'Team Name', value: 'teamName' }, { label: 'Team ID', value: 'teamId' }, { label: 'Delegate ID', value: 'delegateId' }, { label: 'Delegate Name', value: 'name' }, { label: 'CNIC', value: 'cnic' }, { label: 'Phone Number', value: 'phone' },
      ]} />

      {isLoading && <LoadingSpinner />}
      {modifiedTeam && !isLoading && (
        <div className="bg-gray-800 bg-opacity-50 p-4 rounded-lg shadow-lg border border-gray-700">
          <div className="flex items-center space-x-4 mb-6 pb-4 border-b border-gray-700">
            <h3 className="text-xl font-bold text-white">Team: <span className="text-purple-400">{modifiedTeam[0].teamName} ({modifiedTeam[0].teamId})</span></h3>
            <div className="flex items-center">
              <input type="checkbox" id="securityFee" className="h-5 w-5 rounded text-purple-500 bg-gray-700 border-gray-600 focus:ring-purple-600" checked={isSecurityFeePaid} onChange={e => handleCheckboxChange(modifiedTeam[0].delegateId, 'securityFeePaid', e.target.checked)} />
              <label htmlFor="securityFee" className="ml-2 font-semibold text-gray-300">Security Fee Paid</label>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-700">
              <thead className="bg-gray-700 bg-opacity-50">
                <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase">Name</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase">Accommodation</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase">
                        <div className="flex items-center">
                            <input type="checkbox" disabled={!isSecurityFeePaid} checked={areAllWaiversCollected} onChange={e => handleSelectAll('waiverCollected', e.target.checked)} className="h-4 w-4 rounded text-purple-500 bg-gray-700 border-gray-600 mr-2" />
                            Waiver
                        </div>
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase">
                        <div className="flex items-center">
                            <input type="checkbox" disabled={!isSecurityFeePaid} checked={areAllTagsCollected} onChange={e => handleSelectAll('tagsCollected', e.target.checked)} className="h-4 w-4 rounded text-purple-500 bg-gray-700 border-gray-600 mr-2" />
                            Tags
                        </div>
                    </th>
                </tr>
              </thead>
              <tbody className="bg-gray-800 divide-y divide-gray-700">
                {modifiedTeam.map(delegate => (
                  <tr key={delegate.delegateId} className={!isSecurityFeePaid ? 'opacity-50' : ''}>
                    <td className="px-6 py-4"><div className="font-medium text-white">{delegate.name}</div><div className="text-sm text-gray-400">{delegate.delegateId}</div></td>
                    <td className="px-6 py-4 text-sm text-gray-400">{delegate.accommodation}</td>
                    <td className="px-6 py-4"><input type="checkbox" disabled={!isSecurityFeePaid} checked={delegate.waiverCollected} onChange={e => handleCheckboxChange(delegate.delegateId, 'waiverCollected', e.target.checked)} className="h-4 w-4 rounded text-purple-500 bg-gray-700 border-gray-600" /></td>
                    <td className="px-6 py-4"><input type="checkbox" disabled={!isSecurityFeePaid} checked={delegate.tagsCollected} onChange={e => handleCheckboxChange(delegate.delegateId, 'tagsCollected', e.target.checked)} className="h-4 w-4 rounded text-purple-500 bg-gray-700 border-gray-600" /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {isDirty && (
            <div className="mt-6 text-right">
              <button onClick={handleSaveChanges} disabled={isSaving} className="bg-green-600 text-white font-bold py-2 px-6 rounded-md hover:bg-green-700 disabled:bg-green-300">
                {isSaving ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

const AdminView = ({ setNotification }) => {
  const [delegate, setDelegate] = useState(null);
  const [editableDelegate, setEditableDelegate] = useState(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleSearch = async (searchBy, searchTerm) => {
    if (!searchTerm.trim()) { setDelegate(null); return; }
    setIsLoading(true);
    setDelegate(null);
    try {
      const response = await fetchWithTimeout(`/api/delegates/search/?by=${searchBy}&term=${searchTerm}`);
      if (!response.ok) throw new Error('Delegate not found');
      const data = await response.json();
      setDelegate(data);
      setEditableDelegate({ ...data });
    } catch (error) {
      const errorMessage = error.name === 'AbortError' ? 'Request timed out. Please check the backend server.' : error.message;
      setNotification({ message: errorMessage, type: 'error' });
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleInputChange = (field, value) => {
      setEditableDelegate(prev => ({ ...prev, [field]: value }));
  };

  const handleUpdate = async () => {
    setIsLoading(true);
    try {
        const response = await fetch(`/api/delegates/${editableDelegate.delegateId}/`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(editableDelegate)
        });
        if (!response.ok) throw new Error('Update failed');
        setNotification({ message: 'Delegate information updated!', type: 'success' });
        setDelegate(null);
        setEditableDelegate(null);
    } catch (error) {
        setNotification({ message: error.message, type: 'error' });
    } finally {
        setIsLoading(false);
    }
  };

  return (
    <div>
      <SearchBar onSearch={handleSearch} isLoading={isLoading} searchFields={[
        { label: 'Delegate ID', value: 'delegateId' }, { label: 'Delegate Name', value: 'name' }, { label: 'CNIC', value: 'cnic' }, { label: 'Email', value: 'email' },
      ]} />
      {isLoading && <LoadingSpinner />}
      {delegate && editableDelegate && !isLoading && (
        <div className="bg-gray-800 bg-opacity-50 p-6 rounded-lg shadow-lg mt-4 border border-gray-700">
          <h3 className="text-xl font-bold text-white mb-4 border-b border-gray-700 pb-2">Edit Delegate: <span className="text-purple-400">{delegate.name}</span></h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {Object.keys(editableDelegate).map(key => {
              const isReadOnly = ['delegateId', 'teamId', 'securityFeePaid', 'accommCheckIn', 'waiverCollected', 'tagsCollected', 'securityCheckIn'].includes(key);
              return (<div key={key}><label className="block text-sm font-medium text-gray-300 capitalize">{key.replace(/([A-Z])/g, ' $1')}</label><input type="text" value={editableDelegate[key]} readOnly={isReadOnly} onChange={(e) => handleInputChange(key, e.target.value)} className={`mt-1 block w-full p-2 border rounded-md shadow-sm ${isReadOnly ? 'bg-gray-700 cursor-not-allowed text-gray-400' : 'bg-gray-700 border-gray-600 text-white focus:ring-purple-500'}`}/></div>);
            })}
          </div>
          <button onClick={handleUpdate} disabled={isLoading} className="mt-6 bg-green-600 text-white font-bold py-2 px-6 rounded-md hover:bg-green-700 disabled:bg-green-300">
            {isLoading ? 'Updating...' : 'Update Information'}
          </button>
        </div>
      )}
    </div>
  );
};

const SecurityView = ({ setNotification }) => {
  const [originalTeam, setOriginalTeam] = useState(null);
  const [modifiedTeam, setModifiedTeam] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const handleSearch = async (searchBy, searchTerm) => {
    if (!searchTerm.trim()) { setOriginalTeam(null); setModifiedTeam(null); return; }
    setIsLoading(true);
    try {
      const response = await fetchWithTimeout(`/api/teams/search/?by=${searchBy}&term=${searchTerm}`);
      if (!response.ok) throw new Error('Team not found');
      const data = await response.json();
      setOriginalTeam(data);
      setModifiedTeam(JSON.parse(JSON.stringify(data)));
    } catch (error) {
      const errorMessage = error.name === 'AbortError' ? 'Request timed out. Please check the backend server.' : error.message;
      setNotification({ message: errorMessage, type: 'error' });
      setOriginalTeam(null);
      setModifiedTeam(null);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCheckboxChange = (delegateId, field, value) => {
    const updatedTeam = modifiedTeam.map(d => d.delegateId === delegateId ? { ...d, [field]: value } : d);
    setModifiedTeam(updatedTeam);
  };

  const handleSaveChanges = async () => {
    setIsSaving(true);
    const changes = [];
    
    originalTeam.forEach(originalDelegate => {
        const modifiedDelegate = modifiedTeam.find(d => d.delegateId === originalDelegate.delegateId);
        ['securityCheckIn', 'accommCheckIn'].forEach(field => {
            if (originalDelegate[field] !== modifiedDelegate[field]) {
                changes.push({
                    endpoint: `/api/delegates/${modifiedDelegate.delegateId}/update_check/`,
                    payload: { [field]: modifiedDelegate[field] }
                });
            }
        });
    });

    try {
        await Promise.all(changes.map(change => 
            fetch(change.endpoint, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(change.payload)
            })
        ));
        setNotification({ message: 'Info updated successfully!', type: 'success' });
        setOriginalTeam(JSON.parse(JSON.stringify(modifiedTeam)));
    } catch (error) {
        setNotification({ message: 'An error occurred while saving.', type: 'error' });
    } finally {
        setIsSaving(false);
    }
  };

  const isDirty = useMemo(() => JSON.stringify(originalTeam) !== JSON.stringify(modifiedTeam), [originalTeam, modifiedTeam]);
  const isSecurityFeePaid = useMemo(() => modifiedTeam?.[0]?.securityFeePaid || false, [modifiedTeam]);

  return (
    <div>
      <SearchBar onSearch={handleSearch} isLoading={isLoading} searchFields={[
        { label: 'Team Name', value: 'teamName' }, { label: 'Team ID', value: 'teamId' }, { label: 'Delegate ID', value: 'delegateId' }, { label: 'Delegate Name', value: 'name' },
      ]} />
      {isLoading && <LoadingSpinner />}
      {modifiedTeam && !isLoading && (
        <div className="bg-gray-800 bg-opacity-50 p-4 rounded-lg shadow-lg border border-gray-700">
          <div className="flex items-center space-x-6 mb-6 pb-4 border-b border-gray-700">
            <h3 className="text-xl font-bold text-white">Team: <span className="text-purple-400">{modifiedTeam[0].teamName} ({modifiedTeam[0].teamId})</span></h3>
            <div className="flex items-center"><span className="font-semibold text-gray-300 mr-2">Security Fee Paid:</span><span className={`px-3 py-1 text-sm font-bold rounded-full ${isSecurityFeePaid ? 'bg-green-200 text-green-800' : 'bg-red-200 text-red-800'}`}>{isSecurityFeePaid ? 'YES' : 'NO'}</span></div>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-700">
              <thead className="bg-gray-700 bg-opacity-50"><tr><th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase">Name</th><th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase">Accommodation</th><th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase">Security Check-in</th><th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase">Accom. Check-in</th></tr></thead>
              <tbody className="bg-gray-800 divide-y divide-gray-700">
                {modifiedTeam.map(delegate => (
                  <tr key={delegate.delegateId}>
                    <td className="px-6 py-4"><div className="font-medium text-white">{delegate.name}</div><div className="text-sm text-gray-400">{delegate.delegateId}</div></td>
                    <td className="px-6 py-4 text-sm text-gray-400">{delegate.accommodation}</td>
                    <td className="px-6 py-4"><input type="checkbox" disabled={!isSecurityFeePaid} checked={delegate.securityCheckIn} onChange={e => handleCheckboxChange(delegate.delegateId, 'securityCheckIn', e.target.checked)} className="h-4 w-4 rounded text-purple-500 bg-gray-700 border-gray-600" /></td>
                    <td className="px-6 py-4">
                      {delegate.accommodation && delegate.accommodation.toLowerCase() === 'yes' && (
                        <input type="checkbox" disabled={!isSecurityFeePaid} checked={delegate.accommCheckIn} onChange={e => handleCheckboxChange(delegate.delegateId, 'accommCheckIn', e.target.checked)} className="h-4 w-4 rounded text-purple-500 bg-gray-700 border-gray-600" />
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {isDirty && (
            <div className="mt-6 text-right">
              <button onClick={handleSaveChanges} disabled={isSaving} className="bg-green-600 text-white font-bold py-2 px-6 rounded-md hover:bg-green-700 disabled:bg-green-300">
                {isSaving ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

const SessionAttendanceView = ({ setNotification }) => {
    const [originalTeam, setOriginalTeam] = useState(null);
    const [modifiedTeam, setModifiedTeam] = useState(null);
    const [isLoading, setIsLoading] = useState(false);
    const [isSaving, setIsSaving] = useState(false);

    const handleSearch = async (searchBy, searchTerm) => {
        if (!searchTerm.trim()) { setOriginalTeam(null); setModifiedTeam(null); return; }
        setIsLoading(true);
        try {
            const response = await fetchWithTimeout(`/api/teams/search/?by=${searchBy}&term=${searchTerm}`);
            if (!response.ok) throw new Error('Team not found');
            const data = await response.json();
            setOriginalTeam(data);
            setModifiedTeam(JSON.parse(JSON.stringify(data)));
        } catch (error) {
            setNotification({ message: error.message, type: 'error' });
            setOriginalTeam(null);
            setModifiedTeam(null);
        } finally {
            setIsLoading(false);
        }
    };

    const handleCheckboxChange = (delegateId, field, value) => {
        const updatedTeam = modifiedTeam.map(d => d.delegateId === delegateId ? { ...d, [field]: value } : d);
        setModifiedTeam(updatedTeam);
    };

    const handleSaveChanges = async () => {
        setIsSaving(true);
        const changes = [];
        originalTeam.forEach(originalDelegate => {
            const modifiedDelegate = modifiedTeam.find(d => d.delegateId === originalDelegate.delegateId);
            if (originalDelegate.sessionAttendance !== modifiedDelegate.sessionAttendance) {
                changes.push({
                    endpoint: `/api/delegates/${modifiedDelegate.delegateId}/update_check/`,
                    payload: { sessionAttendance: modifiedDelegate.sessionAttendance }
                });
            }
        });

        try {
            await Promise.all(changes.map(change => 
                fetch(change.endpoint, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(change.payload)
                })
            ));
            setNotification({ message: 'Attendance updated successfully!', type: 'success' });
            setOriginalTeam(JSON.parse(JSON.stringify(modifiedTeam)));
        } catch (error) {
            setNotification({ message: 'An error occurred while saving.', type: 'error' });
        } finally {
            setIsSaving(false);
        }
    };

    const isDirty = useMemo(() => JSON.stringify(originalTeam) !== JSON.stringify(modifiedTeam), [originalTeam, modifiedTeam]);
    const isSecurityFeePaid = useMemo(() => modifiedTeam?.[0]?.securityFeePaid || false, [modifiedTeam]);

    return (
        <div>
            <SearchBar onSearch={handleSearch} isLoading={isLoading} searchFields={[{ label: 'Team Name', value: 'teamName' }, { label: 'Team ID', value: 'teamId' }]} />
            {isLoading && <LoadingSpinner />}
            {modifiedTeam && !isLoading && (
                <div className="bg-gray-800 bg-opacity-50 p-4 rounded-lg shadow-lg border border-gray-700">
                    <h3 className="text-xl font-bold text-white">Team: <span className="text-purple-400">{modifiedTeam[0].teamName} ({modifiedTeam[0].teamId})</span></h3>
                    <p className="text-gray-300 mt-1">Allotted Stream: <span className="font-semibold">{modifiedTeam[0].allottedStream || 'N/A'}</span></p>
                    <div className="overflow-x-auto mt-4">
                        <table className="min-w-full divide-y divide-gray-700">
                            <thead className="bg-gray-700 bg-opacity-50"><tr><th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase">Name</th><th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase">Mark Attendance</th></tr></thead>
                            <tbody className="bg-gray-800 divide-y divide-gray-700">
                                {modifiedTeam.map(d => (
                                    <tr key={d.delegateId} className={!isSecurityFeePaid ? 'opacity-50' : ''}>
                                        <td className="px-6 py-4"><div className="font-medium text-white">{d.name}</div><div className="text-sm text-gray-400">{d.delegateId}</div></td>
                                        <td className="px-6 py-4"><input type="checkbox" disabled={!isSecurityFeePaid} checked={d.sessionAttendance} onChange={e => handleCheckboxChange(d.delegateId, 'sessionAttendance', e.target.checked)} className="h-4 w-4 rounded text-purple-500 bg-gray-700 border-gray-600" /></td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                     {isDirty && (
                        <div className="mt-6 text-right">
                        <button onClick={handleSaveChanges} disabled={isSaving} className="bg-green-600 text-white font-bold py-2 px-6 rounded-md hover:bg-green-700 disabled:bg-green-300">
                            {isSaving ? 'Saving...' : 'Save Changes'}
                        </button>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

const WorkshopAttendanceView = ({ setNotification }) => {
    const [originalTeam, setOriginalTeam] = useState(null);
    const [modifiedTeam, setModifiedTeam] = useState(null);
    const [isLoading, setIsLoading] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const workshops = useMemo(() => modifiedTeam?.[0]?.allottedWorkshops?.split(',').map(w => w.trim()) || [], [modifiedTeam]);

    const handleSearch = async (searchBy, searchTerm) => {
        if (!searchTerm.trim()) { setOriginalTeam(null); setModifiedTeam(null); return; }
        setIsLoading(true);
        try {
            const response = await fetchWithTimeout(`/api/teams/search/?by=${searchBy}&term=${searchTerm}`);
            if (!response.ok) throw new Error('Team not found');
            const data = await response.json();
            setOriginalTeam(data);
            setModifiedTeam(JSON.parse(JSON.stringify(data)));
        } catch (error) {
            setNotification({ message: error.message, type: 'error' });
            setOriginalTeam(null);
            setModifiedTeam(null);
        } finally {
            setIsLoading(false);
        }
    };

    const handleCheckboxChange = (delegateId, workshopIndex, value) => {
        const field = `workshopAttendance${workshopIndex + 1}`;
        const updatedTeam = modifiedTeam.map(d => d.delegateId === delegateId ? { ...d, [field]: value } : d);
        setModifiedTeam(updatedTeam);
    };
    
    const handleSaveChanges = async () => {
        setIsSaving(true);
        const changes = [];
        originalTeam.forEach(originalDelegate => {
            const modifiedDelegate = modifiedTeam.find(d => d.delegateId === originalDelegate.delegateId);
            workshops.forEach((ws, index) => {
                const field = `workshopAttendance${index + 1}`;
                if (originalDelegate[field] !== modifiedDelegate[field]) {
                    changes.push({
                        endpoint: `/api/delegates/${modifiedDelegate.delegateId}/update_check/`,
                        payload: { [field]: modifiedDelegate[field] }
                    });
                }
            });
        });

        try {
            await Promise.all(changes.map(change => 
                fetch(change.endpoint, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(change.payload)
                })
            ));
            setNotification({ message: 'Attendance updated successfully!', type: 'success' });
            setOriginalTeam(JSON.parse(JSON.stringify(modifiedTeam)));
        } catch (error) {
            setNotification({ message: 'An error occurred while saving.', type: 'error' });
        } finally {
            setIsSaving(false);
        }
    };

    const isDirty = useMemo(() => JSON.stringify(originalTeam) !== JSON.stringify(modifiedTeam), [originalTeam, modifiedTeam]);
    const isSecurityFeePaid = useMemo(() => modifiedTeam?.[0]?.securityFeePaid || false, [modifiedTeam]);

    return (
        <div>
            <SearchBar onSearch={handleSearch} isLoading={isLoading} searchFields={[{ label: 'Team Name', value: 'teamName' }, { label: 'Team ID', value: 'teamId' }]} />
            {isLoading && <LoadingSpinner />}
            {modifiedTeam && !isLoading && (
                <div className="bg-gray-800 bg-opacity-50 p-4 rounded-lg shadow-lg border border-gray-700">
                    <h3 className="text-xl font-bold text-white">Team: <span className="text-purple-400">{modifiedTeam[0].teamName} ({modifiedTeam[0].teamId})</span></h3>
                     <p className="text-gray-300 mt-1">Allotted Workshops: <span className="font-semibold">{modifiedTeam[0].allottedWorkshops || 'N/A'}</span></p>
                    <div className="overflow-x-auto mt-4">
                        <table className="min-w-full divide-y divide-gray-700">
                            <thead className="bg-gray-700 bg-opacity-50">
                                <tr>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase">Name</th>
                                    {workshops.map((ws, index) => <th key={index} className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase">{ws}</th>)}
                                </tr>
                            </thead>
                            <tbody className="bg-gray-800 divide-y divide-gray-700">
                                {modifiedTeam.map(d => (
                                    <tr key={d.delegateId} className={!isSecurityFeePaid ? 'opacity-50' : ''}>
                                        <td className="px-6 py-4"><div className="font-medium text-white">{d.name}</div><div className="text-sm text-gray-400">{d.delegateId}</div></td>
                                        {workshops.map((ws, index) => (
                                            <td key={index} className="px-6 py-4"><input type="checkbox" disabled={!isSecurityFeePaid} checked={d[`workshopAttendance${index + 1}`] || false} onChange={e => handleCheckboxChange(d.delegateId, index, e.target.checked)} className="h-4 w-4 rounded text-purple-500 bg-gray-700 border-gray-600" /></td>
                                        ))}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                    {isDirty && (
                        <div className="mt-6 text-right">
                        <button onClick={handleSaveChanges} disabled={isSaving} className="bg-green-600 text-white font-bold py-2 px-6 rounded-md hover:bg-green-700 disabled:bg-green-300">
                            {isSaving ? 'Saving...' : 'Save Changes'}
                        </button>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};


const LoginView = ({ onLogin, setNotification }) => {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    const handleLogin = async (e) => {
        e.preventDefault();
        setIsLoading(true);
        try {
            const response = await fetch('/api/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password })
            });
            if (!response.ok) {
                throw new Error('Invalid username or password');
            }
            const data = await response.json();
            onLogin(data.token);
        } catch (error) {
            setNotification({ message: error.message, type: 'error' });
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="flex items-center justify-center min-h-screen bg-gray-900">
            <div className="w-full max-w-md p-8 space-y-6 bg-gray-800 rounded-lg shadow-lg border border-gray-700">
                <h2 className="text-2xl font-bold text-center text-white">Admin Login</h2>
                <form className="space-y-6" onSubmit={handleLogin}>
                    <div>
                        <label htmlFor="username" className="text-sm font-medium text-gray-300">Username</label>
                        <input id="username" name="username" type="text" required value={username} onChange={e => setUsername(e.target.value)}
                            className="w-full px-3 py-2 mt-1 bg-gray-700 border border-gray-600 text-white rounded-md shadow-sm focus:outline-none focus:ring-purple-500 focus:border-purple-500" />
                    </div>
                    <div>
                        <label htmlFor="password"className="text-sm font-medium text-gray-300">Password</label>
                        <input id="password" name="password" type="password" required value={password} onChange={e => setPassword(e.target.value)}
                            className="w-full px-3 py-2 mt-1 bg-gray-700 border border-gray-600 text-white rounded-md shadow-sm focus:outline-none focus:ring-purple-500 focus:border-purple-500" />
                    </div>
                    <div>
                        <button type="submit" disabled={isLoading}
                            className="w-full px-4 py-2 font-medium text-white bg-purple-600 rounded-md hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500 disabled:bg-purple-400">
                            {isLoading ? 'Logging in...' : 'Log In'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};


// --- Main App Component ---

export default function App() {
  const [activeTab, setActiveTab] = useState('On Spot Reg');
  const [notification, setNotification] = useState({ message: '', type: '' });
  const [token, setToken] = useState(() => localStorage.getItem('authToken'));

  const handleLogin = (newToken) => {
      localStorage.setItem('authToken', newToken);
      setToken(newToken);
  };

  const handleLogout = () => {
      localStorage.removeItem('authToken');
      setToken(null);
  };

  if (!token) {
      return <LoginView onLogin={handleLogin} setNotification={setNotification} />;
  }

  const tabs = ['On Spot Reg', 'Admin Use Only', 'Security Reg', 'Session Attendance', 'Workshop Attendance'];

  const renderView = () => {
    switch (activeTab) {
      case 'On Spot Reg': return <OnSpotRegView setNotification={setNotification} />;
      case 'Admin Use Only': return <AdminView setNotification={setNotification} />;
      case 'Security Reg': return <SecurityView setNotification={setNotification} />;
      case 'Session Attendance': return <SessionAttendanceView setNotification={setNotification} />;
      case 'Workshop Attendance': return <WorkshopAttendanceView setNotification={setNotification} />;
      default: return <OnSpotRegView setNotification={setNotification} />;
    }
  };

  return (
    <div className="bg-gray-900 text-white min-h-screen font-sans p-4 sm:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto">
        <header className="mb-8 flex justify-between items-center">
          <div>
            <h1 className="text-4xl font-bold text-white">LSS '25 Registrations System</h1>
            <p className="text-gray-400 mt-2">A modern solution for event management.</p>
          </div>
          <button onClick={handleLogout} className="bg-red-600 text-white font-bold py-2 px-4 rounded-md hover:bg-red-700 transition duration-300">
            Logout
          </button>
        </header>

        <Notification message={notification.message} type={notification.type} onDismiss={() => setNotification({ message: '', type: ''})} />

        <div className="border-b border-gray-700 mb-6">
          <nav className="-mb-px flex space-x-6" aria-label="Tabs">
            {tabs.map(tab => (
              <button key={tab} onClick={() => setActiveTab(tab)} className={`${activeTab === tab ? 'border-purple-400 text-purple-400' : 'border-transparent text-gray-400 hover:text-gray-300 hover:border-gray-500'} whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm transition-colors duration-200 focus:outline-none`}>
                {tab}
              </button>
            ))}
          </nav>
        </div>
        <main>{renderView()}</main>
      </div>
    </div>
  );
}
