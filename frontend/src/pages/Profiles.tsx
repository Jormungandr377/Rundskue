import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { User, Plus, Edit2, Trash2, Star, Check, X } from 'lucide-react';
import { api } from '../api';
import type { Profile } from '../types';

interface ProfileFormData {
  name: string;
  is_primary: boolean;
}

export default function Profiles() {
  const queryClient = useQueryClient();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingProfile, setEditingProfile] = useState<Profile | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null);
  const [formData, setFormData] = useState<ProfileFormData>({
    name: '',
    is_primary: false,
  });

  const { data: profiles, isLoading } = useQuery({
    queryKey: ['profiles'],
    queryFn: api.profiles.list,
  });

  const createMutation = useMutation({
    mutationFn: api.profiles.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profiles'] });
      setShowCreateModal(false);
      resetForm();
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<Profile> }) =>
      api.profiles.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profiles'] });
      setEditingProfile(null);
      resetForm();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: api.profiles.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profiles'] });
      setDeleteConfirm(null);
    },
  });

  const resetForm = () => {
    setFormData({ name: '', is_primary: false });
  };

  const handleCreate = () => {
    if (!formData.name.trim()) return;
    createMutation.mutate(formData);
  };

  const handleUpdate = () => {
    if (!editingProfile || !formData.name.trim()) return;
    updateMutation.mutate({
      id: editingProfile.id,
      data: formData,
    });
  };

  const handleDelete = (id: number) => {
    deleteMutation.mutate(id);
  };

  const startEdit = (profile: Profile) => {
    setEditingProfile(profile);
    setFormData({
      name: profile.name,
      is_primary: profile.is_primary,
    });
  };

  const cancelEdit = () => {
    setEditingProfile(null);
    resetForm();
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-surface-900">Profiles</h1>
          <p className="text-surface-600 mt-1">
            Manage financial profiles for different people or purposes
          </p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
        >
          <Plus className="w-5 h-5" />
          Add Profile
        </button>
      </div>

      {/* Profiles Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {profiles?.map((profile) => (
          <div
            key={profile.id}
            className="bg-white rounded-lg shadow-sm border border-surface-200 p-6 hover:shadow-md transition-shadow"
          >
            {editingProfile?.id === profile.id ? (
              /* Edit Mode */
              <div className="space-y-4">
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-surface-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  placeholder="Profile name"
                  autoFocus
                />
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={formData.is_primary}
                    onChange={(e) =>
                      setFormData({ ...formData, is_primary: e.target.checked })
                    }
                    className="w-4 h-4 text-primary-600 border-surface-300 rounded focus:ring-primary-500"
                  />
                  <span className="text-sm text-surface-700">Primary profile</span>
                </label>
                <div className="flex justify-end gap-2">
                  <button
                    onClick={cancelEdit}
                    className="p-2 text-surface-600 hover:text-surface-800 hover:bg-surface-100 rounded-lg transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                  <button
                    onClick={handleUpdate}
                    disabled={updateMutation.isPending}
                    className="p-2 text-primary-600 hover:text-primary-800 hover:bg-primary-50 rounded-lg transition-colors"
                  >
                    <Check className="w-5 h-5" />
                  </button>
                </div>
              </div>
            ) : (
              /* View Mode */
              <>
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-3 bg-primary-100 rounded-full">
                      <User className="w-6 h-6 text-primary-600" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-surface-900 flex items-center gap-2">
                        {profile.name}
                        {profile.is_primary && (
                          <Star className="w-4 h-4 text-yellow-500 fill-yellow-500" />
                        )}
                      </h3>
                      <p className="text-sm text-surface-500">
                        {profile.email || 'No email set'}
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <button
                      onClick={() => startEdit(profile)}
                      className="p-2 text-surface-400 hover:text-surface-600 hover:bg-surface-100 rounded-lg transition-colors"
                      title="Edit profile"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    {!profile.is_primary && (
                      <button
                        onClick={() => setDeleteConfirm(profile.id)}
                        className="p-2 text-surface-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        title="Delete profile"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Profile Stats */}
                <div className="mt-4 pt-4 border-t border-surface-100">
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-surface-500">TSP Contribution</span>
                      <p className="font-medium text-surface-900">
                        {profile.tsp_contribution_pct || 0}%
                      </p>
                    </div>
                    <div>
                      <span className="text-surface-500">Base Pay</span>
                      <p className="font-medium text-surface-900">
                        {profile.base_pay ? `$${Number(profile.base_pay).toLocaleString()}` : 'Not set'}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Delete Confirmation */}
                {deleteConfirm === profile.id && (
                  <div className="mt-4 p-3 bg-red-50 rounded-lg border border-red-200">
                    <p className="text-sm text-red-800 mb-3">
                      Delete this profile and all associated data?
                    </p>
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() => setDeleteConfirm(null)}
                        className="px-3 py-1 text-sm text-surface-600 hover:text-surface-800"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={() => handleDelete(profile.id)}
                        disabled={deleteMutation.isPending}
                        className="px-3 py-1 text-sm bg-red-600 text-white rounded hover:bg-red-700"
                      >
                        {deleteMutation.isPending ? 'Deleting...' : 'Delete'}
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        ))}

        {/* Empty State */}
        {profiles?.length === 0 && (
          <div className="col-span-full text-center py-12 bg-surface-50 rounded-lg border-2 border-dashed border-surface-300">
            <User className="w-12 h-12 text-surface-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-surface-900 mb-2">
              No profiles yet
            </h3>
            <p className="text-surface-500 mb-4">
              Create a profile to start tracking your finances
            </p>
            <button
              onClick={() => setShowCreateModal(true)}
              className="inline-flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
            >
              <Plus className="w-5 h-5" />
              Create First Profile
            </button>
          </div>
        )}
      </div>

      {/* Create Profile Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full mx-4">
            <div className="p-6 border-b border-surface-200">
              <h2 className="text-xl font-semibold text-surface-900">
                Create New Profile
              </h2>
              <p className="text-sm text-surface-500 mt-1">
                Add a profile to track finances for yourself or someone else
              </p>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-surface-700 mb-1">
                  Profile Name
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-surface-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  placeholder="e.g., Personal, Joint, Business"
                  autoFocus
                />
              </div>

              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={formData.is_primary}
                  onChange={(e) =>
                    setFormData({ ...formData, is_primary: e.target.checked })
                  }
                  className="w-4 h-4 text-primary-600 border-surface-300 rounded focus:ring-primary-500"
                />
                <span className="text-sm text-surface-700">
                  Set as primary profile
                </span>
              </label>

              {formData.is_primary && profiles && profiles.some(p => p.is_primary) && (
                <p className="text-sm text-amber-600 bg-amber-50 p-3 rounded-lg">
                  This will replace your current primary profile
                </p>
              )}
            </div>

            <div className="p-6 border-t border-surface-200 flex justify-end gap-3">
              <button
                onClick={() => {
                  setShowCreateModal(false);
                  resetForm();
                }}
                className="px-4 py-2 text-surface-700 hover:text-surface-900"
              >
                Cancel
              </button>
              <button
                onClick={handleCreate}
                disabled={!formData.name.trim() || createMutation.isPending}
                className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {createMutation.isPending ? 'Creating...' : 'Create Profile'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
