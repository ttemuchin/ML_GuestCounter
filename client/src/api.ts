import axios from 'axios';

const API_BASE_URL = 'http://localhost:8000';

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
//   headers: {
//     'Content-Type': 'multipart/form-data',
//   },
});

export type ImageInfo = {
  id: string;
  filename: string;
  original_filename: string;
  uploaded_at: string;
  status: string;
  guest_count?: number;
  processing_time?: number;
}

export type ProcessResponse = {
  image_id: string;
  status: string;
  guest_count: number;
  processing_time: number;
  message: string;
}

export type BatchUploadResponse = {
  images: ImageInfo[];
  total_uploaded: number;
}

export type BatchProcessResponse = {
  results: ProcessResponse[];
  total_processed: number;
}

export type StatisticsResponse = {
  total_images: number;
  total_guests: number;
  avg_guests_per_image: number;
  recent_images: ImageInfo[];
}

export type RawStatsResponse = {
  stats: {
    timestamp: string;
    id: string;
    people_count: number;
    process_time: number;
    confidences: number[];
  }[];
}

export const apiService = {
  async uploadImages(files: File[]): Promise<BatchUploadResponse> {
    const formData = new FormData();
    
    files.forEach(f => {
        formData.append('files', f);
    })

    const response = await api.post<BatchUploadResponse>('/upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  },

  async processImages(imageIds: string[]): Promise<BatchProcessResponse> {
    const response = await api.post<BatchProcessResponse>('/process', {
      image_ids: imageIds
    });
    return response.data;
  },

  // async getStatistics(): Promise<StatisticsResponse> {
  //   const response = await api.get<StatisticsResponse>('/statistics');
  //   return response.data;
  // },

  async listImages(): Promise<{ images: ImageInfo[] }> {
    const response = await api.get<{ images: ImageInfo[] }>('/images');
    return response.data;
  },

  async getImageInfo(imageId: string): Promise<ImageInfo> {
    const response = await api.get<ImageInfo>(`/image/${imageId}`);
    return response.data;
  },

  async getAllStats(): Promise<RawStatsResponse> {
    const response = await api.get<RawStatsResponse>('/stats/all');
    return response.data;
  },
};