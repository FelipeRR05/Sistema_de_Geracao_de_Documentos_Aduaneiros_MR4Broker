import axios from 'axios';

const API_URL = 'http://127.0.0.1:8000';

const api = axios.create({
    baseURL: API_URL
});

/**
 * Função para fazer o upload e parsing do arquivo (POST /api/upload/parse).
 * @param {File} file 
 * @returns {Promise} 
 */
export const uploadAndParseFile = (file) => {
    const formData = new FormData();
    formData.append('file', file);
    
    return api.post('/api/upload/parse', formData, {
        headers: {
            'Content-Type': 'multipart/form-data'
        }
    });
};

export const getStagingData = (operationId) => {
    return api.get(`/api/operation/${operationId}/staging`); 
};