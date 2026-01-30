import { useState, useEffect } from 'react';
import styles from './ContentArea.module.css';
// import { apiService } from '../api';
import { useImageContext } from '../context/ImageContext';
import Statistics from './Statistics';

function ContentArea() {
  const { 
    uploadedImages,
    selectedLeftIndex,
    setSelectedLeftIndex,
    selectedRightIndex,
    setSelectedRightIndex,
    leftMessages,
    rightMessages,
    processedImages,
    showStatistics,
  } = useImageContext();

  const [imageUrls, setImageUrls] = useState<string[]>([]);

  useEffect(() => {
    if (uploadedImages.length > 0) {
      const urls = uploadedImages.map(img => 
        `http://localhost:8000/download/${img.filename}`
      );
      setImageUrls(urls);
      // if (showStatistics) {
      //   setShowStatistics(false);
      // }
    } else {
      setImageUrls([]);
    }
  }, [uploadedImages]);

  const handleLeftPrev = () => {
  if (uploadedImages.length > 0) {
    const newIndex = selectedLeftIndex === 0 ? uploadedImages.length - 1 : selectedLeftIndex - 1;
    setSelectedLeftIndex(newIndex);
  }
};

const handleLeftNext = () => {
  if (uploadedImages.length > 0) {
    const newIndex = selectedLeftIndex === uploadedImages.length - 1 ? 0 : selectedLeftIndex + 1;
    setSelectedLeftIndex(newIndex);
  }
};

const handleRightPrev = () => {
  if (processedImages.length > 0) {
    const newIndex = selectedRightIndex === 0 ? processedImages.length - 1 : selectedRightIndex - 1;
    setSelectedRightIndex(newIndex);
  }
};

const handleRightNext = () => {
  if (processedImages.length > 0) {
    const newIndex = selectedRightIndex === processedImages.length - 1 ? 0 : selectedRightIndex + 1;
    setSelectedRightIndex(newIndex);
  }
};

  const handleLeftImageClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    
    if (x < rect.width / 2) {
      handleLeftPrev();
    } else {
      handleLeftNext();
    }
  };

  const handleRightImageClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    
    if (x < rect.width / 2) {
      handleRightPrev();
    } else {
      handleRightNext();
    }
  };

  return (
    <div className={styles.contentBackcover}>
      <div className={styles.contentArea}>
        <div className={styles.contentBody}>

          <div className={styles.leftSection}>
            
            {uploadedImages.length === 0 ? (
              <div className={styles.placeholder}>
                <h4>Загрузите изображения для начала детекции</h4>
              </div>
            ) : (
              <div className={styles.imageContainer}>
                {uploadedImages.length > 1 && (
                  <div className={styles.imageCounter}>
                    {selectedLeftIndex + 1} / {uploadedImages.length}
                  </div>
                )}
                
                <div 
                  className={styles.imageWrapper}
                  onClick={handleLeftImageClick}
                  style={{ cursor: uploadedImages.length > 1 ? 'pointer' : 'default' }}
                >
                  {imageUrls[selectedLeftIndex] ? (
                    <img 
                      src={imageUrls[selectedLeftIndex]} 
                      className={styles.image}
                    />
                  ) : (
                    <div className={styles.loadingImage}>Загрузка изображения...</div>
                  )}
                </div>
                
                {leftMessages[selectedLeftIndex] && (
                  <div className={styles.statusMessage}>
                    {leftMessages[selectedLeftIndex]}
                  </div>
                )}
              </div>
            )}
          </div>

          <div className={styles.rightSection}>
            
            {processedImages.length === 0 ? (
              <div className={styles.placeholder}>
                <h4>Ожидание обработки</h4>
                {rightMessages.length > 0 && rightMessages[selectedRightIndex] && (
                  <div className={styles.statusMessage}>
                    {rightMessages[selectedRightIndex]}
                  </div>
                )}
              </div>
            ) : (
              <div className={styles.imageContainer}>
                {processedImages.length > 1 && (
                  <div className={styles.imageCounter}>
                    {selectedRightIndex + 1} / {processedImages.length}
                  </div>
                )}
                
                <div 
                  className={styles.imageWrapper}
                  onClick={handleRightImageClick}
                  style={{ cursor: processedImages.length > 1 ? 'pointer' : 'default' }}
                >
                  <img 
                    src={processedImages[selectedRightIndex]} 
                    className={styles.image}
                  />
                </div>

                {rightMessages[selectedRightIndex] && (
                  <div className={styles.statusMessage}>
                    {rightMessages[selectedRightIndex]}
                  </div>
                )}
                </div>
            )}
          </div>
        </div>

        {showStatistics && <Statistics />}
        
        <div id="statistics-anchor"></div>
      </div>
    </div>
  );
}

export default ContentArea;