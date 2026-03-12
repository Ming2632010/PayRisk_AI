// src/components/CustomerNotes.tsx
import { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2, X, Clock } from 'lucide-react';
import { api } from '../lib/api';
import { formatDate } from '../utils/scoring';

/** Note stored in customers.notes jsonb column */
export interface StoredNote {
  id: number;
  content: string;
  created_at: string;
}

interface CustomerNotesProps {
  customerId: number;
  userId: string;
  onClose?: () => void;
}

export function CustomerNotes({ customerId, userId, onClose }: CustomerNotesProps) {
  const [notes, setNotes] = useState<StoredNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingNote, setEditingNote] = useState<StoredNote | null>(null);
  const [content, setContent] = useState('');

  useEffect(() => {
    loadNotes();
  }, [customerId]);

  async function loadNotes() {
    try {
      const data = await api.notes.list(customerId);
      const arr = Array.isArray(data) ? data : [];
      setNotes(arr as StoredNote[]);
    } catch (error) {
      console.error('Error loading notes:', error);
    } finally {
      setLoading(false);
    }
  }

  async function saveNotes(newNotes: StoredNote[]) {
    await api.notes.save(customerId, newNotes);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!content.trim()) return;

    try {
      if (editingNote) {
        const newNotes = notes.map((n) =>
          n.id === editingNote.id
            ? { ...n, content: content.trim(), created_at: n.created_at }
            : n
        );
        await saveNotes(newNotes);
      } else {
        const newNote: StoredNote = {
          id: Date.now(),
          content: content.trim(),
          created_at: new Date().toISOString(),
        };
        await saveNotes([...notes, newNote]);
      }
      setContent('');
      setEditingNote(null);
      setShowForm(false);
      loadNotes();
    } catch (error) {
      console.error('Error saving note:', error);
      alert('Failed to save note');
    }
  }

  async function handleDelete(id: number) {
    if (!confirm('Are you sure you want to delete this note?')) return;

    try {
      await saveNotes(notes.filter((n) => n.id !== id));
      loadNotes();
    } catch (error) {
      console.error('Error deleting note:', error);
      alert('Failed to delete note');
    }
  }

  function handleEdit(note: StoredNote) {
    setEditingNote(note);
    setContent(note.content);
    setShowForm(true);
  }

  function handleCancel() {
    setContent('');
    setEditingNote(null);
    setShowForm(false);
  }

  if (loading) {
    return <div className="text-center py-4">Loading notes...</div>;
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900">Customer Notes</h3>
        <div className="flex gap-2">
          {!showForm && (
            <button
              onClick={() => setShowForm(true)}
              className="flex items-center gap-1 px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm"
            >
              <Plus className="w-4 h-4" />
              Add Note
            </button>
          )}
          {onClose && (
            <button
              onClick={onClose}
              className="p-1.5 text-gray-400 hover:text-gray-600"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* 添加/编辑表单 */}
      {showForm && (
        <form onSubmit={handleSubmit} className="mb-4">
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Write your note here..."
            rows={4}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            autoFocus
          />
          <div className="flex justify-end gap-2 mt-2">
            <button
              type="button"
              onClick={handleCancel}
              className="px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 rounded-lg"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm"
            >
              {editingNote ? 'Update' : 'Save'}
            </button>
          </div>
        </form>
      )}

      {/* 备注列表 */}
      {notes.length === 0 ? (
        <p className="text-center text-gray-500 py-4">No notes yet</p>
      ) : (
        <div className="space-y-3 max-h-96 overflow-y-auto">
          {notes.map((note) => (
            <div
              key={note.id}
              className="p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
            >
              <p className="text-gray-800 whitespace-pre-wrap">{note.content}</p>
              <div className="flex items-center justify-between mt-2">
                <div className="flex items-center gap-1 text-xs text-gray-400">
                  <Clock className="w-3 h-3" />
                  {formatDate(note.created_at ?? null)}
                </div>
                <div className="flex gap-1">
                  <button
                    onClick={() => handleEdit(note)}
                    className="p-1 text-blue-600 hover:bg-blue-100 rounded"
                    title="Edit"
                  >
                    <Edit2 className="w-3 h-3" />
                  </button>
                  <button
                    onClick={() => handleDelete(note.id)}
                    className="p-1 text-red-600 hover:bg-red-100 rounded"
                    title="Delete"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}