import type { ChatConversation, FavoriteSchool, UserUpdate } from '../types';
import { Bell, History, Plus, Search, Star, X } from 'lucide-react';

export type ChatUtilityPanelKind = 'history' | 'favorites' | 'activity';

export interface ChatUtilityPanelProps {
  panel: ChatUtilityPanelKind;
  conversations: ChatConversation[];
  favorites: FavoriteSchool[];
  updates: UserUpdate[];
  notice: string;
  localOnly: boolean;
  localOnlyMessage: string;
  lastSyncedAt: string | null;
  onSelectConversation: (conversation: ChatConversation) => void;
  onNewConversation: () => void;
  onSearchFavorite: (schoolName: string) => void;
  onRemoveFavorite: (universityId: string) => void;
  onOpenUpdate: (update: UserUpdate) => void;
  onDismissNotice: () => void;
}

const formatDate = (value: string) => new Date(value).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });

const panelTitles: Record<ChatUtilityPanelKind, string> = {
  history: 'Chat history',
  favorites: 'Favorite schools',
  activity: 'Activity',
};

export function ChatUtilityPanel({
  panel,
  conversations,
  favorites,
  updates,
  notice,
  localOnly,
  localOnlyMessage,
  lastSyncedAt,
  onSelectConversation,
  onNewConversation,
  onSearchFavorite,
  onRemoveFavorite,
  onOpenUpdate,
  onDismissNotice,
}: ChatUtilityPanelProps) {
  return (
    <div className="chat-utility-content">
      <div className="chat-utility-heading">
        {panel === 'history' ? <History aria-hidden="true" /> : panel === 'favorites' ? <Star aria-hidden="true" /> : <Bell aria-hidden="true" />}
        <h2>{panelTitles[panel]}</h2>
        {panel === 'history' && <button type="button" className="chat-utility-new" onClick={onNewConversation}><Plus aria-hidden="true" />New chat</button>}
      </div>

      {panel === 'history' && (
        conversations.length === 0
          ? <p className="chat-utility-empty">Your recent conversations will appear here.</p>
          : <ul className="chat-utility-list">{conversations.map((conversation) => (
            <li key={conversation.id}>
              <button type="button" className="chat-utility-item" onClick={() => onSelectConversation(conversation)}>
                <span className="chat-utility-item-title">{conversation.title}</span>
                <span className="chat-utility-item-meta">{formatDate(conversation.updatedAt)}</span>
              </button>
            </li>
          ))}</ul>
      )}

      {panel === 'favorites' && (
        favorites.length === 0
          ? <p className="chat-utility-empty">Favorite a school from a route result and it will be saved here.</p>
          : <ul className="chat-utility-list">{favorites.map((favorite) => (
            <li key={favorite.universityId} className="chat-utility-favorite">
              <button type="button" className="chat-utility-item" aria-label={`Search ${favorite.universityName}`} onClick={() => onSearchFavorite(favorite.universityName)}>
                <span className="chat-utility-item-title">{favorite.universityName}</span>
                <span className="chat-utility-item-meta"><Search aria-hidden="true" />Search routes</span>
              </button>
              <button type="button" className="chat-utility-icon-button" aria-label={`Remove ${favorite.universityName} from favorites`} onClick={() => onRemoveFavorite(favorite.universityId)}><X aria-hidden="true" /></button>
            </li>
          ))}</ul>
      )}

      {panel === 'activity' && (
        updates.length === 0 && !notice && !localOnly
          ? <p className="chat-utility-empty">You’re all caught up. New school and route updates will appear here.</p>
          : <>
          {(notice || localOnly) && <section className="chat-utility-status" aria-label="App status">
            {localOnly && <p><span className="chat-status-indicator" aria-hidden="true" />{localOnlyMessage} Chat and history are saved on this device.{lastSyncedAt && <span className="chat-utility-item-meta">Last synced {formatDate(lastSyncedAt)}.</span>}</p>}
            {notice && <div className="chat-utility-notice"><p>{notice}</p><button type="button" aria-label="Dismiss notification" onClick={onDismissNotice}><X aria-hidden="true" /></button></div>}
          </section>}
          {updates.length > 0 && <ul className="chat-utility-list">{updates.map((update) => (
            <li key={update.id}>
              <button type="button" className="chat-utility-item chat-utility-activity" onClick={() => onOpenUpdate(update)}>
                <span className="chat-utility-activity-title"><span className="chat-utility-item-title">{update.title}</span>{!update.isRead && <span className="chat-utility-new-badge">New</span>}</span>
                <span className="chat-utility-item-summary">{update.summary}</span>
                <span className="chat-utility-item-meta">{formatDate(update.createdAt)} · View affected schools</span>
              </button>
            </li>
          ))}</ul>}
          </>
      )}
    </div>
  );
}
