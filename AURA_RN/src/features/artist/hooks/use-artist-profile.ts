import { useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';

import { showAlert, useToast } from '@/components/ui';
import { ApiError, auraApi } from '@/core/api';
import { useAuth } from '@/core/auth-context';
import { appendUploadFile } from '@/core/native-upload';
import { IMAGE_MAX_SIZE, pickImageForm, pickImageUpload } from '@/core/pick-image';
import type { Song } from '@/core/types';
import { useAuraQuery } from '@/core/use-aura-query';
import { useOpenAddToPlaylist } from '@/hooks/use-open-add-to-playlist';
import { useRefreshCatalog } from '@/hooks/use-refresh-catalog';

const message = (error: unknown, fallback: string) => (error instanceof Error ? error.message : fallback);

/**
 * Data and actions for an artist page: the artist, their songs, albums,
 * follow status and stats, plus everything the owner can do (photo, bio,
 * song artwork, deleting songs or the whole artist account). The screen only
 * renders what this returns.
 *
 * `id` is an artist id, or 'me' for the signed-in user's own artist page.
 */
export function useArtistProfile(id: string | undefined) {
  const router = useRouter();
  const toast = useToast();
  const { getToken, user } = useAuth();
  const queryClient = useQueryClient();
  const refreshCatalog = useRefreshCatalog();
  const openAddToPlaylist = useOpenAddToPlaylist();
  const [mutationError, setMutationError] = useState<string | null>(null);
  const [working, setWorking] = useState(false);
  // Set once the artist account is deleted, so the "not found" redirect doesn't fire while leaving.
  const [deleted, setDeleted] = useState(false);
  const isOwnProfile = id === 'me' || id === 'current_user' || id === user?.uid;

  const query = useAuraQuery(
    ['catalog', 'artist-profile', id],
    async (token) => {
      if (!id) throw new Error('Artist id is missing.');
      const artist = isOwnProfile ? await auraApi.getMyArtist(token) : await auraApi.artist(token, id);
      const [songs, albums, followStatus, stats] = await Promise.all([
        isOwnProfile ? auraApi.myArtistSongs(token) : auraApi.artistSongs(token, artist.id),
        auraApi.albumsByArtist(token, artist.id),
        isOwnProfile ? Promise.resolve({ following: false }) : auraApi.isFollowingArtist(token, artist.id),
        // Stats are a nice-to-have; an older backend without them shouldn't break the page.
        auraApi.artistStats(token, artist.id).catch(() => null),
      ]);
      return { artist, songs, albums, following: followStatus.following, stats };
    },
    Boolean(id),
  );

  const artist = query.data?.artist ?? null;
  const following = query.data?.following ?? false;
  // Your own page when you aren't an artist yet: go to the "Become an artist" setup.
  const artistNotFound = isOwnProfile && query.error instanceof ApiError && query.error.status === 404;

  useEffect(() => {
    if (artistNotFound && !deleted) router.replace('/artist-dashboard');
  }, [artistNotFound, deleted, router]);

  /** Runs an owner action with the shared busy/error state, then refreshes everything showing the catalogue. */
  const run = async (action: (token: string) => Promise<unknown>, failure: string) => {
    setWorking(true);
    setMutationError(null);
    try {
      await action(await getToken());
      await refreshCatalog();
      return true;
    } catch (error) {
      setMutationError(message(error, failure));
      return false;
    } finally {
      setWorking(false);
    }
  };

  const toggleFollow = async () => {
    if (!artist) return;
    setWorking(true);
    setMutationError(null);
    try {
      await auraApi.followArtist(await getToken(), artist.id, !following);
      await query.refetch();
      // Follows feed Home's "Artists you follow" and "Made for you".
      void queryClient.invalidateQueries({ queryKey: ['library', 'followed-artists'] });
      void queryClient.invalidateQueries({ queryKey: ['home', 'for-you'] });
    } catch (error) {
      setMutationError(message(error, 'Could not update follow status.'));
    } finally {
      setWorking(false);
    }
  };

  /** Owner menu for one of their songs: add to playlist, new artwork, or delete. */
  const manageSong = (song: Song) =>
    showAlert(song.title, 'What would you like to do?', [
      { text: 'Add to playlist', onPress: () => openAddToPlaylist(song) },
      {
        text: 'Replace artwork',
        onPress: () => {
          void (async () => {
            const form = await pickImageForm('artwork', {
              fallbackName: 'song-artwork.jpg',
              maxSize: IMAGE_MAX_SIZE.artwork,
            });
            if (form)
              await run((token) => auraApi.replaceSongArtwork(token, song.id, form), 'Artwork could not be updated.');
          })();
        },
      },
      {
        text: 'Delete song',
        style: 'destructive',
        onPress: () =>
          showAlert('Delete this song?', `"${song.title}" and its audio will be removed for everyone.`, [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Delete',
              style: 'destructive',
              onPress: () => void run((token) => auraApi.deleteSong(token, song.id), 'Song could not be deleted.'),
            },
          ]),
      },
      { text: 'Cancel', style: 'cancel' },
    ]);

  /** Saves a new bio; resolves to true when saved. */
  const saveBio = (bio: string) => {
    if (!artist) return Promise.resolve(false);
    // The endpoint replaces the whole profile, so resend the current name and photo.
    return run(
      (token) => auraApi.createArtist(token, { name: artist.name, bio: bio.trim() || null, imageUrl: artist.imageUrl }),
      'Bio could not be saved.',
    );
  };

  const chooseArtistImage = async () => {
    const image = await pickImageUpload({ fallbackName: 'artist-profile.jpg', maxSize: IMAGE_MAX_SIZE.avatar });
    if (!image) return;
    const form = new FormData();
    appendUploadFile(form, 'file', image);
    await run((token) => auraApi.uploadArtistImage(token, form), 'Artist photo could not be uploaded.');
  };

  /** Removes the artist profile, albums and uploads; the listener account stays. */
  const deleteArtistAccount = () =>
    showAlert(
      'Delete artist account?',
      'This permanently removes your artist profile, albums and uploaded songs. Your listener account remains.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete artist account',
          style: 'destructive',
          onPress: () => {
            setWorking(true);
            void getToken()
              .then((token) => auraApi.deleteArtist(token))
              .then(() => {
                setDeleted(true);
                toast.show({ title: 'Artist account deleted', message: 'Your listener account is still here.' });
                if (router.canGoBack()) router.back();
                else router.replace('/(tabs)');
                void refreshCatalog();
              })
              .catch((error: unknown) =>
                showAlert('Could not delete artist account', message(error, 'Please try again.')),
              )
              .finally(() => setWorking(false));
          },
        },
      ],
    );

  return {
    query,
    isOwnProfile,
    artistNotFound,
    artist,
    songs: query.data?.songs ?? [],
    albums: query.data?.albums ?? [],
    following,
    stats: query.data?.stats ?? null,
    error: mutationError ?? (query.error instanceof Error ? query.error.message : null),
    /** Only errors from owner actions (e.g. saving the bio), not from loading the page. */
    actionError: mutationError,
    clearError: () => setMutationError(null),
    working,
    toggleFollow,
    manageSong,
    saveBio,
    chooseArtistImage,
    deleteArtistAccount,
  };
}
