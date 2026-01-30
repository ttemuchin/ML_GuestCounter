import { useRef } from 'react';
import styles from './MainHeader.module.css';
import { apiService } from '../api';
import { useImageContext } from '../context/ImageContext';
import { useSessionContext } from '../context/SessionContext';

function MainHeader() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { 
    uploadedImages,
    setUploadedImages,
    setLeftMessages,
    setRightMessages,
    setProcessedImages,
    processingCount,
    incrementProcessingCount,
    resetProcessingCount,
    setShowStatistics
  } = useImageContext();

  const { addSessionRequest } = useSessionContext();
  
  const handleFileSelect = () => {
    fileInputRef.current?.click();
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    if (files.length === 0) return;

    resetProcessingCount();
    setLeftMessages([]);
    setRightMessages([]);
    setProcessedImages([]);
    setUploadedImages([]);
    setShowStatistics(false);

    try {
      const result = await apiService.uploadImages(files);
      
      setUploadedImages(result.images);
      const messages = result.images.map(() => 'Изображение загружено');
      setLeftMessages(messages);
      
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    } catch (error) {
      console.error('Ошибка загрузки:', error);
      const messages = Array<string>(files.length).fill('Ошибка при загрузке изображения');
      setLeftMessages(messages);
      setUploadedImages([]);
    }
  };

  const handleProcessImage = async () => {
    if (uploadedImages.length === 0 || processingCount >= 2) return;

    incrementProcessingCount();
    const processingMessages = Array<string>(uploadedImages.length).fill('Обработка...');
    setRightMessages(processingMessages);

    try {
      const imageIds = uploadedImages.map(img => img.id);
      const result = await apiService.processImages(imageIds);
      console.log(result);

      setTimeout(async () => {
        try {
          const processedUrls = await Promise.all(
            uploadedImages.map(img => {
              const fileExtension = String(img.filename.split('.').pop());
              return `http://localhost:8000/download/${img.id}_annotated.${fileExtension}`;
            })
          );
          setProcessedImages(processedUrls);
          
          const successMessages = Array<string>(uploadedImages.length).fill('Обработка завершена');
          setRightMessages(successMessages);

          setTimeout(async () => {
          try {
            const updatedInfos = await Promise.all(
              uploadedImages.map(img => apiService.getImageInfo(img.id))
            );
            
            const guestCounts = updatedInfos.map(info => info.guest_count ?? 0);
            const totalGuests = guestCounts.reduce((sum, count) => sum + count, 0);
            
            const now = new Date();
            addSessionRequest({
              timestamp: now.toISOString(),
              timestampFormatted: now.toLocaleString('ru-RU').replace(',', ''), // "15.01.2025 14:30"
              imageIds,
              guestCounts,
              totalGuests,
            });
            
          } catch (err) {
            console.error('Ошибка при добавлении в историю:', err);
          }
        }, 2000);

        } catch {
          const errorMessages = Array<string>(uploadedImages.length).fill('Ошибка получения результата');
          setRightMessages(errorMessages);
        }
      }, 5000);

    } catch (error) {
      console.error('Ошибка обработки:', error);
      const errorMessages = Array<string>(uploadedImages.length).fill('Ошибка при обработке изображения');
      setRightMessages(errorMessages);
    }
  };

  const handleGetStatistics = () => {
    try {
      // const stats = await apiService.getStatistics();
      // console.log('Статистика:', stats);
      setShowStatistics(true);
      setTimeout(() => {
        const statsElement = document.getElementById('statistics-anchor');
        if (statsElement) {
          statsElement.scrollIntoView({ behavior: 'smooth' });
        }
      }, 800);
    } catch (error) {
      console.error('Ошибка получения статистики:', error);
      alert('Ошибка получения статистики');
    }
  };

  const handleFileUploadSync = (event: React.ChangeEvent<HTMLInputElement>) => {
    void handleFileUpload(event);
  };

  const handleProcessImageSync = () => {
    void handleProcessImage();
  };

  return (
    <header className={styles.backcover}>
      <div className={styles.header}>
        <div className={styles.leftColumn}>
          <a href="#" className={styles.titleLink}>
            <h1 className={styles.title}>GUEST COUNTER</h1>
            <h2 className={styles.subtitle}>CV Сервис</h2>
          </a>
          <hr />
        </div>
        <div className={styles.verticalDivider}></div>
        <div className={styles.rightColumn}>
          <div className={styles.field}>
            <div className={styles.topLinks}>
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileUploadSync}
                accept="image/*"
                multiple
                style={{ display: 'none' }}
              />
              
              <button onClick={handleFileSelect} className={styles.headerButton}>
                Загрузить файл
              </button>
              <button 
                onClick={handleProcessImageSync}
                className={styles.headerButton}
                disabled={uploadedImages.length === 0 || processingCount >= 2}
              >
                Начать обработку
              </button>
              <button onClick={handleGetStatistics} className={styles.headerButton}>
                Статистика
              </button>
            </div>
            <hr />
          </div>
        </div>
      </div>
    </header>
  );
}

export default MainHeader;