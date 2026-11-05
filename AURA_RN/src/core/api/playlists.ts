import type { InvitePreview, PlaylistDetail, PlaylistInvite, PlaylistSummary } from '../types';
import { encode, json, request } from './client';

const base = (id: string) => `library/playlists/${encode(id)}`;

export const playlistsApi = {
  playlists: (token: string) => request<PlaylistSummary[]>('library/playlists', token),
  createPlaylist: (token: string, title: string) =>
    request<PlaylistSummary>('library/playlists', token, json('POST', { title })),
  playlist: (token: string, id: string, signal?: AbortSignal) => request<PlaylistDetail>(base(id), token, { signal }),
  updatePlaylist: (token: string, id: string, changes: { title?: string; isPublic?: boolean; description?: string | null }) =>
    request<PlaylistDetail>(base(id), token, json('PATCH', changes)),
  deletePlaylist: (token: string, id: string) => request<void>(base(id), token, { method: 'DELETE' }),

  addSongToPlaylist: (token: string, playlistId: string, songId: string) =>
    request<PlaylistSummary>(`${base(playlistId)}/songs`, token, json('POST', { songId })),
  removeSongFromPlaylist: (token: string, playlistId: string, songId: string) =>
    request<PlaylistDetail>(`${base(playlistId)}/songs/${encode(songId)}`, token, { method: 'DELETE' }),
  reorderPlaylist: (token: string, playlistId: string, songIds: string[]) =>
    request<PlaylistDetail>(`${base(playlistId)}/order`, token, json('PUT', { songIds })),

  createInvite: (token: string, playlistId: string, role: 'viewer' | 'editor') =>
    request<PlaylistInvite>(`${base(playlistId)}/invites`, token, json('POST', { role })),
  revokeInvites: (token: string, playlistId: string) =>
    request<void>(`${base(playlistId)}/invites`, token, { method: 'DELETE' }),
  invitePreview: (token: string, code: string) =>
    request<InvitePreview>(`library/playlists/invites/${encode(code)}`, token),
  acceptInvite: (token: string, code: string) =>
    request<{ playlistId: string; role: string }>(`library/playlists/invites/${encode(code)}/accept`, token, json('POST', {})),
  updateCollaborator: (token: string, playlistId: string, userId: string, role: 'viewer' | 'editor') =>
    request<PlaylistDetail>(`${base(playlistId)}/collaborators/${encode(userId)}`, token, json('PATCH', { role })),
  removeCollaborator: (token: string, playlistId: string, userId: string) =>
    request<void>(`${base(playlistId)}/collaborators/${encode(userId)}`, token, { method: 'DELETE' }),
};
