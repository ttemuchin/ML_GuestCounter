import React, { createContext, useContext, useState, ReactNode } from 'react';
import { ImageInfo } from '../api';

type ImageContextType = {
  uploadedImages: ImageInfo[];
  setUploadedImages: (images: ImageInfo[]) => void;
  selectedLeftIndex: number;
  setSelectedLeftIndex: React.Dispatch<React.SetStateAction<number>>;
  selectedRightIndex: number;
  setSelectedRightIndex: React.Dispatch<React.SetStateAction<number>>;
  leftMessages: string[];
  setLeftMessages: (messages: string[]) => void;
  rightMessages: string[];
  setRightMessages: (messages: string[]) => void;
  processingCount: number;
  incrementProcessingCount: () => void;
  resetProcessingCount: () => void;
  processedImages: string[];
  setProcessedImages: (urls: string[]) => void;
  showStatistics: boolean;
  setShowStatistics: React.Dispatch<React.SetStateAction<boolean>>;
}

const ImageContext = createContext<ImageContextType | undefined>(undefined);

export const useImageContext = () => {
  const context = useContext(ImageContext);
  if (!context) {
    throw new Error('useImageContext must be used within ImageProvider');
  }
  return context;
};

type ImageProviderProps = {
  children: ReactNode;
}

export const ImageProvider: React.FC<ImageProviderProps> = ({ children }) => {
  const [uploadedImages, setUploadedImages] = useState<ImageInfo[]>([]);
  const [selectedLeftIndex, setSelectedLeftIndex] = useState<number>(0);
  const [selectedRightIndex, setSelectedRightIndex] = useState<number>(0);
  const [leftMessages, setLeftMessages] = useState<string[]>([]);
  const [rightMessages, setRightMessages] = useState<string[]>([]);
  const [processingCount, setProcessingCount] = useState<number>(0);
  const [processedImages, setProcessedImages] = useState<string[]>([]);
  const [showStatistics, setShowStatistics] = useState<boolean>(false);

  const incrementProcessingCount = () => {
    setProcessingCount(prev => prev + 1);
  };

  const resetProcessingCount = () => {
    setProcessingCount(0);
  };

  return (
    <ImageContext.Provider value={{
      uploadedImages,
      setUploadedImages,
      selectedLeftIndex,
      setSelectedLeftIndex,
      selectedRightIndex,
      setSelectedRightIndex,
      leftMessages,
      setLeftMessages,
      rightMessages,
      setRightMessages,
      processingCount,
      incrementProcessingCount,
      resetProcessingCount,
      processedImages,
      setProcessedImages,
      showStatistics,
      setShowStatistics
    }}>
      {children}
    </ImageContext.Provider>
  );
};