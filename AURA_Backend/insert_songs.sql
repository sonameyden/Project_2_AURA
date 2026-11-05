-- Insert 21 songs into Supabase from uploaded audio files
-- Run this in Supabase SQL editor

insert into songs (id, title, artist_id, artist_name, duration_ms, stream_url, genre, valence, energy)
values
  ('song-1', 'Ordinary', 'artist-alex-warren', 'Alex Warren', 180000, 'https://vdywyvomkadlgfjcwxke.supabase.co/storage/v1/object/public/audio/Alex%20Warren%20-%20Ordinary%20(Lyrics)_1768018834632.mp3', 'pop', 0.6, 0.5),
  ('song-2', 'Lovers', 'artist-anna-north', 'Anna of the North', 190000, 'https://vdywyvomkadlgfjcwxke.supabase.co/storage/v1/object/public/audio/Anna%20of%20the%20North%20-%20Lovers%20(Lyrics)_1739637533430.mp3', 'indie', 0.7, 0.6),
  ('song-3', 'Beautiful', 'artist-anyma', 'Anyma & Joji', 210000, 'https://vdywyvomkadlgfjcwxke.supabase.co/storage/v1/object/public/audio/Anyma_Joj_Beautiful_Lyrics_1777294165983.mp3', 'electronic', 0.8, 0.7),
  ('song-4', 'Step On Up', 'artist-ariana-grande', 'Ariana Grande', 200000, 'https://vdywyvomkadlgfjcwxke.supabase.co/storage/v1/object/public/audio/ARIANA%20GRANDE%20-%20STEP%20ON%20UP(LYRICS)_1741198715075.mp3', 'pop', 0.8, 0.8),
  ('song-5', 'Supernatural', 'artist-ariana-grande', 'Ariana Grande', 220000, 'https://vdywyvomkadlgfjcwxke.supabase.co/storage/v1/object/public/audio/Ariana%20Grande%20-%20supernatural%20(Lyrics)_1745462959949.mp3', 'pop', 0.7, 0.7),
  ('song-6', 'Like That', 'artist-babymonster', 'BABYMONSTER', 240000, 'https://vdywyvomkadlgfjcwxke.supabase.co/storage/v1/object/public/audio/BABYMONSTER%20-%20'LIKE%20THAT'%20EXCLUSIVE%20PERFORMANCE%20VIDEO.mp3', 'kpop', 0.8, 0.9),
  ('song-7', 'I Want It That Way', 'artist-backstreet-boys', 'Backstreet Boys', 225000, 'https://vdywyvomkadlgfjcwxke.supabase.co/storage/v1/object/public/audio/Backstreet%20Boys%20-%20I%20Want%20It%20That%20Way%20(Lyrics)_1736499131328.mp3', 'pop', 0.7, 0.6),
  ('song-8', 'Do I Clench My Fists?', 'artist-ridgeclub', 'ridgeclub', 200000, 'https://vdywyvomkadlgfjcwxke.supabase.co/storage/v1/object/public/audio/do%20i%20clench%20my%20fists_1786108770629.mp3', 'indie', 0.5, 0.5),
  ('song-9', 'Free Lyric Video', 'artist-kpop-demon-cast', 'KPop Demon Hunters Cast', 210000, 'https://vdywyvomkadlgfjcwxke.supabase.co/storage/v1/object/public/audio/Free_Lyric_Video_KPop_Demon_Hunters_Netflix_Family_1751989189026.mp3', 'kpop', 0.7, 0.8),
  ('song-10', 'Workin Hard', 'artist-fujii-kaze', 'Fujii Kaze', 195000, 'https://vdywyvomkadlgfjcwxke.supabase.co/storage/v1/object/public/audio/Fujii_Kaze_Workin_Hard_Official_Video_1734087041768.mp3', 'j-pop', 0.6, 0.7),
  ('song-11', 'Golden', 'artist-kpop-demon-cast', 'KPop Demon Hunters Cast', 215000, 'https://vdywyvomkadlgfjcwxke.supabase.co/storage/v1/object/public/audio/Golden_Official_Lyric_Video_KPop_Demon_Hunters_Sony_Animation_1752060426340.mp3', 'kpop', 0.8, 0.8),
  ('song-12', 'HSKT', 'artist-lee-hi', 'Lee Hi', 230000, 'https://vdywyvomkadlgfjcwxke.supabase.co/storage/v1/object/public/audio/Lee_Hi_-_HSKT_Feat._Wonstein_Audio_1754052393798.mp3', 'kpop', 0.7, 0.7),
  ('song-13', '10 Minutes', 'artist-lee-hyori', 'Lee Hyori', 205000, 'https://vdywyvomkadlgfjcwxke.supabase.co/storage/v1/object/public/audio/Lee_Hyori_10_Minutes_Lyrics_Color_Coded_Han_Rom_Eng.m4a', 'kpop', 0.6, 0.5),
  ('song-14', 'Sure Thing', 'artist-miguel', 'Miguel', 240000, 'https://vdywyvomkadlgfjcwxke.supabase.co/storage/v1/object/public/audio/Miguel%20-%20Sure%20Thing%20(Lyrics).m4a', 'rnb', 0.8, 0.6),
  ('song-15', 'Opalite', 'artist-taylor-swift', 'Taylor Swift', 225000, 'https://vdywyvomkadlgfjcwxke.supabase.co/storage/v1/object/public/audio/Taylor%20Swift%20-%20Opalite%20(Visualizer)_1759679906613.mp3', 'pop', 0.7, 0.7),
  ('song-16', 'Starboy', 'artist-the-weeknd', 'The Weeknd', 215000, 'https://vdywyvomkadlgfjcwxke.supabase.co/storage/v1/object/public/audio/The%20Weeknd%20-%20Starboy%20ft.%20Daft%20Punk%20(Official%20Video).mp3', 'electronic', 0.8, 0.8),
  ('song-17', 'Tsham Tshay', 'artist-sonam-wangchen', 'Sonam Wangchen', 235000, 'https://vdywyvomkadlgfjcwxke.supabase.co/storage/v1/object/public/audio/Tsham%20Tshay%20-%20Sonam%20Wangchen%20ft.%20Leczin%20and%20Alien%20%20OFFICIAL%20MUSIC%20VIDEO%20%20%40YeshiLhendupFilms%20_1757168608037.mp3', 'world', 0.7, 0.6),
  ('song-18', 'Where Am I Supposed To Go?', 'artist-ridgeclub', 'ridgeclub', 190000, 'https://vdywyvomkadlgfjcwxke.supabase.co/storage/v1/object/public/audio/where%20am%20i%20supposed%20to%20go_1786108773220.mp3', 'indie', 0.5, 0.4),
  ('song-19', 'Worry (Ultra Slowed)', 'artist-unknown-3', 'Unknown Artist', 350000, 'https://vdywyvomkadlgfjcwxke.supabase.co/storage/v1/object/public/audio/worry%20(ultra%20slowed)_1778828482128.mp3', 'ambient', 0.4, 0.3),
  ('song-20', 'ZUKI', 'artist-sonam-wangchen', 'Sonam Wangchen', 240000, 'https://vdywyvomkadlgfjcwxke.supabase.co/storage/v1/object/public/audio/ZUKI%20-%20Sonam%20Wangchen%20%20Tensin%20Yangden%20Dorje%20%20%40YeshiLhendupFilms_1746332997781.mp3', 'world', 0.7, 0.7),
  ('song-21', 'ZUKI', 'artist-sonam-wangchen', 'Sonam Wangchen', 240000, 'https://vdywyvomkadlgfjcwxke.supabase.co/storage/v1/object/public/audio/ZUKI_-_Sonam_Wangchen_Tensin_Yangden_Dorje_YeshiLhendupFilms_1746332997781.mp3', 'world', 0.7, 0.7)
on conflict (id) do nothing;

-- Also insert artists
insert into artists (id, name, bio, is_verified)
values
  ('artist-alex-warren', 'Alex Warren', 'Singer-songwriter', true),
  ('artist-anna-north', 'Anna of the North', 'Electronic pop duo', true),
  ('artist-anyma', 'Anyma & Joji', 'Electronic music producers', true),
  ('artist-ariana-grande', 'Ariana Grande', 'Pop star', true),
  ('artist-babymonster', 'BABYMONSTER', 'K-pop group', true),
  ('artist-backstreet-boys', 'Backstreet Boys', 'Boy band', true),
  ('artist-fujii-kaze', 'Fujii Kaze', 'Japanese singer', true),
  ('artist-lee-hi', 'Lee Hi', 'K-pop artist', true),
  ('artist-lee-hyori', 'Lee Hyori', 'K-pop legend', true),
  ('artist-miguel', 'Miguel', 'R&B artist', true),
  ('artist-taylor-swift', 'Taylor Swift', 'Pop/country artist', true),
  ('artist-the-weeknd', 'The Weeknd', 'Electronic pop artist', true),
  ('artist-sonam-wangchen', 'Sonam Wangchen', 'Bhutanese singer-songwriter', true),
  ('artist-ridgeclub', 'ridgeclub', 'Indie music artist', true),
  ('artist-kpop-demon-cast', 'KPop Demon Hunters Cast', 'Netflix film soundtrack cast', false)
on conflict (id) do nothing;
