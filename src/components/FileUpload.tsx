import { useState, useRef, useCallback } from 'react';

export default function FileUpload({ onFileUploaded, isProcessing }) {
    const [isDragging, setIsDragging] = useState(false);
    const [uploadedFile, setUploadedFile] = useState(null);
    const fileInputRef = useRef(null);

    const handleDragOver = useCallback((e) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(true);
    }, []);

    const handleDragLeave = useCallback((e) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);
    }, []);

    const handleDrop = useCallback((e) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);

        const files = e.dataTransfer.files;
        if (files.length > 0 && files[0].type === 'application/pdf') {
            processFile(files[0]);
        }
    }, []);

    const handleFileSelect = useCallback((e) => {
        const file = e.target.files[0];
        if (file && file.type === 'application/pdf') {
            processFile(file);
        }
    }, []);

    const processFile = (file) => {
        setUploadedFile({
            name: file.name,
            size: (file.size / 1024 / 1024).toFixed(2),
        });
        onFileUploaded(file);
    };

    const formatSize = (mb) => {
        return parseFloat(mb) < 1 ? `${(mb * 1024).toFixed(0)} KB` : `${mb} MB`;
    };

    return (
        <div className="file-upload-section">
            <div
                className={`file-dropzone ${isDragging ? 'dragging' : ''} ${uploadedFile ? 'has-file' : ''} ${isProcessing ? 'processing' : ''}`}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => !uploadedFile && fileInputRef.current?.click()}
            >
                <input
                    ref={fileInputRef}
                    type="file"
                    accept=".pdf"
                    onChange={handleFileSelect}
                    style={{ display: 'none' }}
                />

                {isProcessing ? (
                    <div className="upload-processing">
                        <div className="processing-spinner"></div>
                        <span className="processing-text">Analyzing paper...</span>
                    </div>
                ) : uploadedFile ? (
                    <div className="upload-success">
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                            <path d="m9 11 3 3L22 4" />
                        </svg>
                        <div className="upload-file-info">
                            <span className="upload-filename">{uploadedFile.name}</span>
                            <span className="upload-filesize">{formatSize(uploadedFile.size)}</span>
                        </div>
                        <button
                            className="upload-clear"
                            onClick={(e) => {
                                e.stopPropagation();
                                setUploadedFile(null);
                            }}
                        >
                            ×
                        </button>
                    </div>
                ) : (
                    <div className="upload-prompt">
                        <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
                            <polyline points="14 2 14 8 20 8" />
                            <path d="M12 18v-6" />
                            <path d="m9 15 3-3 3 3" />
                        </svg>
                        <span className="upload-title">Drop PDF here</span>
                        <span className="upload-subtitle">or click to browse</span>
                    </div>
                )}
            </div>
        </div>
    );
}
