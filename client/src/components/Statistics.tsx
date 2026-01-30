import { useState, useEffect } from 'react';
import styles from './Statistics.module.css';
import { apiService } from '../api';
import { useSessionContext } from '../context/SessionContext';

type RawStatsItem = {
  timestamp: string;
  id: string;
  people_count: number;
  process_time: number;
  confidences: number[];
}

type ProcessedStatsItem = {
  min_confidence: number;
} & RawStatsItem

function Statistics() {
  const [stats, setStats] = useState<ProcessedStatsItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { sessionHistory } = useSessionContext();

  const loadStatistics = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await apiService.getAllStats();
      const rawStats = response.stats;
      
      const processedStats: ProcessedStatsItem[] = rawStats
        .map((item: RawStatsItem) => ({
          ...item,
          min_confidence: item.confidences.length > 0 
            ? Math.min(...item.confidences)
            : 0
        }))
        .slice(-4)
        .reverse();
      
      setStats(processedStats);
    } catch (err) {
      console.error('Ошибка загрузки статистики:', err);
      setError('Не удалось загрузить статистику');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadStatistics();
  }, []);

  const generateExcelReport = async () => {
    try {
        const response = await apiService.getAllStats();
        const allStats: RawStatsItem[] = response.stats;
        
        if (allStats.length === 0) {
        alert('Файл статистики пуст');
        return;
        }
        
        const headers = ['Дата и время', 'ID изображения', 'Количество людей', 'Время обработки (сек)', 'Минимальная уверенность', 'Все уверенности'];
        
        const rows = allStats.map(row => {
        const minConfidence = row.confidences.length > 0 
            ? Math.min(...row.confidences) 
            : 0;
        
        return [
            row.timestamp,
            row.id,
            row.people_count.toString(),
            row.process_time.toFixed(3),
            minConfidence.toFixed(3),
            row.confidences.map(c => c.toFixed(3)).join(';')
        ];
        });
        
        const csvContent = [
        headers.join(','),
        ...rows.map(row => row.join(','))
        ].join('\n');
        
        const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `cafe_full_statistics_${new Date().toISOString().split('T')[0]}.csv`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        
    } catch (error) {
        console.error('Ошибка генерации отчета:', error);
        alert('Ошибка при генерации отчета');
    }
    };

  const generateSessionJson = () => {
    const sessionData = {
      exportDate: new Date().toISOString(),
      totalRequests: sessionHistory.length,
      totalImagesProcessed: sessionHistory.reduce((sum, req) => sum + req.imageIds.length, 0),
      totalGuestsDetected: sessionHistory.reduce((sum, req) => sum + req.totalGuests, 0),
      requests: sessionHistory
    };
    
    const jsonString = JSON.stringify(sessionData, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `session_history_${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const loadStatisticsSync = () => {
    void loadStatistics();
  };

  const generateExcelReportSync = () => {
    void generateExcelReport();
  }

  return (
    <div className={styles.statisticsContainer}>
      <h3 className={styles.title}>Статистика обработки</h3>
      
      {loading ? (
        <div className={styles.loading}>Загрузка статистики...</div>
      ) : error ? (
        <div className={styles.error}>{error}</div>
      ) : (
        <>
          <div className={styles.tableContainer}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Дата и время</th>
                  <th>ID</th>
                  <th>Людей</th>
                  <th>Время (сек)</th>
                  <th>Мин. уверенность</th>
                </tr>
              </thead>
              <tbody>
                {stats.length === 0 ? (
                  <tr>
                    <td colSpan={5} className={styles.noData}>
                      Нет данных статистики
                    </td>
                  </tr>
                ) : (
                  stats.map((row, index) => (
                    <tr key={index} className={index % 2 === 0 ? styles.evenRow : styles.oddRow}>
                      <td>{row.timestamp}</td>
                      <td className={styles.idCell}>{row.id}</td>
                      <td className={styles.countCell}>{row.people_count}</td>
                      <td>{row.process_time.toFixed(2)}</td>
                      <td className={styles.confidenceCell}>
                        {row.min_confidence.toFixed(3)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          
          <div className={styles.buttonsContainer}>
            <button 
              onClick={generateExcelReportSync}
              className={styles.exportButton}
              disabled={stats.length === 0}
            >
              Экспорт в CSV
            </button>
            
            <button 
              onClick={generateSessionJson}
              className={styles.exportButton}
              disabled={sessionHistory.length === 0}
            >
              История сессии (JSON)
            </button>
            
            <button 
              onClick={loadStatisticsSync}
              className={styles.refreshButton}
            >
              Обновить
            </button>
          </div>
          
          {sessionHistory.length > 0 && (
            <div className={styles.sessionInfo}>
              <h4>Текущая сессия:</h4>
              <p>Запросов: {sessionHistory.length}</p>
              <p>Изображений обработано: {sessionHistory.reduce((sum, req) => sum + req.imageIds.length, 0)}</p>
              <p>Всего гостей обнаружено: {sessionHistory.reduce((sum, req) => sum + req.totalGuests, 0)}</p>
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default Statistics;