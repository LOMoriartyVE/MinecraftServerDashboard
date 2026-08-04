'use client';

import React, { useState, useEffect } from 'react';
import { FolderOpen, Folder, FileCode, Save, RotateCcw, ArrowLeft } from 'lucide-react';

export default function Files({ apiFetch, serverId, showToast }) {
  const [currentPath, setCurrentPath] = useState('');
  const [files, setFiles] = useState([]);
  const [editingFile, setEditingFile] = useState(null); // { path, content, originalContent }
  const [editorText, setEditorText] = useState('');

  const fetchFiles = async (relPath = '') => {
    try {
      const data = await apiFetch(`/api/servers/${serverId}/files?path=${encodeURIComponent(relPath)}`);
      setFiles(data || []);
      setCurrentPath(relPath);
    } catch (err) {
      showToast(`Failed to open directory: ${err.message}`, 'error');
    }
  };

  useEffect(() => {
    if (!serverId) return;
    fetchFiles('');
    setEditingFile(null);
  }, [serverId]);

  const handleFolderClick = (folderPath) => {
    fetchFiles(folderPath);
  };

  const handleBackClick = () => {
    const parts = currentPath.split('/');
    parts.pop();
    const parentPath = parts.join('/');
    fetchFiles(parentPath);
  };

  const handleFileClick = async (filePath) => {
    try {
      const data = await apiFetch(`/api/servers/${serverId}/files/content?path=${encodeURIComponent(filePath)}`);
      setEditingFile({
        path: filePath,
        originalContent: data.content
      });
      setEditorText(data.content);
      showToast(`Loaded ${filePath.split('/').pop()} into editor`, 'info');
    } catch (err) {
      showToast(`Failed to read file: ${err.message}`, 'error');
    }
  };

  const handleSaveFile = async () => {
    if (!editingFile) return;
    try {
      await apiFetch(`/api/servers/${serverId}/files/save`, {
        method: 'POST',
        body: JSON.stringify({
          path: editingFile.path,
          content: editorText
        })
      });
      setEditingFile(prev => ({ ...prev, originalContent: editorText }));
      showToast(`Saved modifications successfully`, 'success');
    } catch (err) {
      showToast(`Failed to save: ${err.message}`, 'error');
    }
  };

  const handleResetFile = () => {
    if (!editingFile) return;
    setEditorText(editingFile.originalContent);
    showToast(`Reverted modifications`, 'info');
  };

  const sortedFiles = [...files].sort((a, b) => {
    if (a.isDir && !b.isDir) return -1;
    if (!a.isDir && b.isDir) return 1;
    return a.name.localeCompare(b.name);
  });

  return (
    <div className="space-y-4 font-sans h-[calc(100vh-140px)] flex flex-col">
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 flex-1 min-h-0">
        
        {/* Left Side: File tree list */}
        <div className="glass-panel p-4 rounded-2xl flex flex-col min-h-0">
          <div className="flex justify-between items-center pb-2 border-b border-obsidian-700 mb-3 shrink-0">
            <span className="text-xs font-bold text-white flex items-center gap-2">
              <FolderOpen className="w-4 h-4 text-mcgreen-400" /> Root Directory Explorer
            </span>
            <span className="text-[9px] text-slate-500 font-mono">
              /{currentPath}
            </span>
          </div>

          {/* Directory Tree */}
          <div className="flex-1 overflow-y-auto space-y-1 pr-1">
            {currentPath && (
              <button 
                onClick={handleBackClick}
                className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg hover:bg-obsidian-800 text-slate-400 hover:text-white transition-colors text-xs font-mono text-left"
              >
                <ArrowLeft className="w-4 h-4 text-slate-500" />
                <span>.. [Parent Directory]</span>
              </button>
            )}

            {sortedFiles.map(file => {
              const isDirectory = file.isDir;
              return (
                <button 
                  key={file.name}
                  onClick={() => isDirectory ? handleFolderClick(file.path) : handleFileClick(file.path)}
                  className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg hover:bg-obsidian-800 text-slate-300 hover:text-white transition-colors text-xs font-mono text-left"
                >
                  {isDirectory ? (
                    <Folder className="w-4 h-4 text-amber-500 shrink-0" />
                  ) : (
                    <FileCode className="w-4 h-4 text-mcgreen-500 shrink-0" />
                  )}
                  <span className="truncate">{file.name}</span>
                </button>
              );
            })}
            {files.length === 0 && (
              <p className="text-[10px] text-slate-500 text-center py-6 font-mono">Empty directory</p>
            )}
          </div>
        </div>

        {/* Right Side: Config Editor */}
        <div className="lg:col-span-2 glass-panel p-4 rounded-2xl flex flex-col min-h-0">
          <div className="flex justify-between items-center pb-2 border-b border-obsidian-700 mb-3 shrink-0">
            <div>
              <span className="text-xs font-bold text-white block">
                {editingFile ? editingFile.path.split('/').pop() : 'Integrated Text Editor'}
              </span>
              <span className="text-[10px] text-slate-500 font-mono mt-0.5">
                {editingFile ? `Path: /${editingFile.path}` : 'Select a configuration file to edit'}
              </span>
            </div>
            {editingFile && (
              <div className="flex items-center gap-2">
                <button 
                  onClick={handleResetFile}
                  className="px-2.5 py-1 text-xs bg-obsidian-850 hover:bg-obsidian-800 text-slate-300 border border-obsidian-700 rounded-lg flex items-center gap-1 transition-all"
                  title="Revert modifications"
                >
                  <RotateCcw className="w-3.5 h-3.5" /> Reset
                </button>
                <button 
                  onClick={handleSaveFile}
                  className="px-2.5 py-1 text-xs bg-mcgreen-500 hover:bg-mcgreen-600 text-obsidian-950 rounded-lg flex items-center gap-1 font-semibold transition-all active:scale-95 shadow-md shadow-mcgreen-500/20"
                >
                  <Save className="w-3.5 h-3.5" /> Save Changes
                </button>
              </div>
            )}
          </div>

          <div className="flex-1 min-h-0 bg-obsidian-950 border border-obsidian-700 rounded-xl overflow-hidden flex flex-col font-mono text-xs">
            {editingFile ? (
              <textarea 
                value={editorText}
                onChange={(e) => setEditorText(e.target.value)}
                className="flex-1 w-full h-full p-4 bg-obsidian-950 text-slate-200 border-none outline-none resize-none font-mono text-[11px] leading-relaxed select-text"
              />
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-slate-500 text-xs p-6 text-center space-y-2">
                <FileCode className="w-8 h-8 text-slate-600" />
                <p>Click any configuration file in the explorer (e.g. <code className="text-mcgreen-500/80">server.properties</code>, <code className="text-mcgreen-500/80">ops.json</code>) to open in editor</p>
              </div>
            )}
          </div>
        </div>

      </div>

    </div>
  );
}
