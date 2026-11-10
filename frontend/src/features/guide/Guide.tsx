import { useState } from 'react';
import { Modal } from '../../shared/ui/Modal';
import { guideTopics } from './topics';
import './guide.css';

export function Guide({ onClose, onSettings }: { onClose: () => void; onSettings: () => void }) {
  const [query, setQuery] = useState('');
  const keywords = query.trim().toLocaleLowerCase('ru-RU').split(/\s+/).filter(Boolean);
  const topics = guideTopics.filter((topic) => {
    const text = [topic.title, topic.path, ...topic.steps].join(' ').toLocaleLowerCase('ru-RU');
    return keywords.every((keyword) => text.includes(keyword));
  });

  return (
    <Modal title="Справочник" wide onClose={onClose}>
      <div className="guide">
        <p className="guide-intro">
          От первой карточки до совместной работы: выберите вопрос или найдите нужное действие.
        </p>
        <label className="guide-search">
          Поиск по справочнику
          <input
            data-autofocus
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Например: добавить статус или дать доступ"
          />
        </label>
        <p className="guide-count" role="status">
          Тем: {topics.length} из {guideTopics.length}
        </p>
        <div className="guide-topics">
          {topics.map((topic) => (
            <details
              className="guide-topic"
              key={`${topic.id}-${keywords.length > 0}`}
              open={keywords.length > 0 || topic.id === 'start'}
            >
              <summary>{topic.title}</summary>
              <div className="guide-topic-content">
                <p className="guide-path">
                  <span>Где найти</span>
                  {topic.path}
                </p>
                <ol>
                  {topic.steps.map((step) => (
                    <li key={step}>{step}</li>
                  ))}
                </ol>
              </div>
            </details>
          ))}
        </div>
        {topics.length === 0 && (
          <div className="guide-empty">
            <p>По этому запросу ничего не найдено</p>
            <button type="button" onClick={() => setQuery('')}>
              Показать все темы
            </button>
          </div>
        )}
        <div className="modal-actions">
          <button type="button" onClick={onSettings}>
            Перейти в настройки
          </button>
          <button type="button" onClick={onClose}>
            Закрыть
          </button>
        </div>
      </div>
    </Modal>
  );
}
