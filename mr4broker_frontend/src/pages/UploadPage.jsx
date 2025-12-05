// src/pages/UploadPage.jsx

import React, { useState } from 'react';
import { uploadAndParseFile } from '../services/api';

function UploadPage() {
    const [selectedFile, setSelectedFile] = useState(null);
    const [message, setMessage] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    const [parsedResults, setParsedResults] = useState([]);
    const [editableResults, setEditableResults] = useState([]);

    const onFileChange = (event) => {
        setSelectedFile(event.target.files[0]);
    };

    const onFileUpload = async () => {
        if (!selectedFile) {
            setMessage('Selecione um arquivo.');
            return;
        }

        setIsLoading(true);
        setMessage('Processando...');
        setParsedResults([]);
        setEditableResults([]);

        try {
            const response = await uploadAndParseFile(selectedFile);

            setMessage('Arquivo processado!');
            setParsedResults(response.data.parsed_data);

            setEditableResults(response.data.parsed_data.map((i) => ({ ...i })));
        } catch (error) {
            const msg = error.response ? error.response.data.detail : error.message;
            setMessage(`ERRO: ${msg}`);
        } finally {
            setIsLoading(false);
        }
    };

    const handleEdit = (fieldName, newValue) => {
        setEditableResults((prev) =>
            prev.map((item) =>
                item.field_name === fieldName
                    ? { ...item, parsed_value: newValue }
                    : item
            )
        );
    };

    return (
        <div style={{ padding: "20px", maxWidth: "900px", margin: "0 auto" }}>
            <h2>Upload e Extração</h2>

            <div style={{
                border: "1px solid #ddd",
                padding: "16px",
                borderRadius: "8px",
                background: "#fafafa",
                marginBottom: "20px"
            }}>
                <input 
                    type="file" 
                    onChange={onFileChange}
                    disabled={isLoading}
                    style={{ marginBottom: "10px" }}
                />

                <button 
                    onClick={onFileUpload}
                    disabled={!selectedFile || isLoading}
                    style={{
                        padding: "10px 16px",
                        background: "#007bff",
                        border: "none",
                        color: "white",
                        borderRadius: "6px",
                        cursor: "pointer"
                    }}
                >
                    {isLoading ? "Processando..." : "Parsear"}
                </button>
            </div>

            {message && <p>{message}</p>}

            {editableResults.length > 0 && (
                
                <div>
                <div style={{ display: "none" }}>
                    {JSON.stringify(parsedResults)}
                </div>
                    <h3>Resultado (Edite antes de salvar)</h3>

                    <table style={{
                        width: "100%",
                        borderCollapse: "collapse",
                        marginTop: "20px"
                    }}>
                        <thead>
                            <tr style={{ background: "#f0f0f0" }}>
                                <th style={{ border: "1px solid #ccc", padding: "8px" }}>Campo</th>
                                <th style={{ border: "1px solid #ccc", padding: "8px" }}>Valor Editável</th>
                            </tr>
                        </thead>

                        <tbody>
                            {editableResults.map((item) => (
                                <tr key={item.field_name}>
                                    <td style={{ border: "1px solid #ccc", padding: "8px", width: "30%" }}>
                                        {item.field_name}
                                    </td>

                                    <td style={{ border: "1px solid #ccc", padding: "8px" }}>
                                        <textarea
                                            value={item.parsed_value}
                                            onChange={(e) => handleEdit(item.field_name, e.target.value)}
                                            rows={2}
                                            style={{
                                                width: "100%",
                                                border: "1px solid #aaa",
                                                borderRadius: "6px",
                                                padding: "6px",
                                                resize: "vertical"
                                            }}
                                        />
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}

export default UploadPage;
