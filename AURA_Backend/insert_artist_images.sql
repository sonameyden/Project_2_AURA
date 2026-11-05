-- Add artist profile picture URLs to the existing artists table
-- Run this in Supabase SQL editor after the main seed has already been executed.

update artists
set image_url = case id
  when 'artist-alex-warren' then 'https://vdywyvomkadlgfjcwxke.supabase.co/storage/v1/object/public/audio/artists_profile_pic/Alex%20Warren.jpg'
  when 'artist-anna-north' then 'https://vdywyvomkadlgfjcwxke.supabase.co/storage/v1/object/public/audio/artists_profile_pic/Anna%20of%20the%20North.jpg'
  when 'artist-anyma' then 'https://vdywyvomkadlgfjcwxke.supabase.co/storage/v1/object/public/audio/artists_profile_pic/Anyma.jpg'
  when 'artist-ariana-grande' then 'https://vdywyvomkadlgfjcwxke.supabase.co/storage/v1/object/public/audio/artists_profile_pic/ariana%20grande.jpg'
  when 'artist-babymonster' then 'https://vdywyvomkadlgfjcwxke.supabase.co/storage/v1/object/public/audio/artists_profile_pic/Babymonster.jpg'
  when 'artist-backstreet-boys' then 'https://vdywyvomkadlgfjcwxke.supabase.co/storage/v1/object/public/audio/artists_profile_pic/Backstreet_boys.jpg'
  when 'artist-fujii-kaze' then 'https://vdywyvomkadlgfjcwxke.supabase.co/storage/v1/object/public/audio/artists_profile_pic/fujii%20kaze.jpg'
  when 'artist-lee-hi' then 'https://vdywyvomkadlgfjcwxke.supabase.co/storage/v1/object/public/audio/artists_profile_pic/lee%20hi.jpg'
  when 'artist-lee-hyori' then 'https://vdywyvomkadlgfjcwxke.supabase.co/storage/v1/object/public/audio/artists_profile_pic/Lee%20Hyori.jpg'
  when 'artist-miguel' then 'https://vdywyvomkadlgfjcwxke.supabase.co/storage/v1/object/public/audio/artists_profile_pic/Miguel.jpg'
  when 'artist-taylor-swift' then 'https://vdywyvomkadlgfjcwxke.supabase.co/storage/v1/object/public/audio/artists_profile_pic/taylor%20swift.jpg'
  when 'artist-the-weeknd' then 'https://vdywyvomkadlgfjcwxke.supabase.co/storage/v1/object/public/audio/artists_profile_pic/weekend.jpg'
  when 'artist-sonam-wangchen' then 'https://vdywyvomkadlgfjcwxke.supabase.co/storage/v1/object/public/audio/artists_profile_pic/Sonam%20wangchen.png'
  when 'artist-ridgeclub' then 'https://vdywyvomkadlgfjcwxke.supabase.co/storage/v1/object/public/audio/artists_profile_pic/ridge_club.png'
  else image_url
end
where id in (
  'artist-alex-warren',
  'artist-anna-north',
  'artist-anyma',
  'artist-ariana-grande',
  'artist-babymonster',
  'artist-backstreet-boys',
  'artist-fujii-kaze',
  'artist-lee-hi',
  'artist-lee-hyori',
  'artist-miguel',
  'artist-taylor-swift',
  'artist-the-weeknd',
  'artist-sonam-wangchen',
  'artist-ridgeclub'
);

-- Optional: if you also want to set the cast image entry
update artists
set image_url = 'https://vdywyvomkadlgfjcwxke.supabase.co/storage/v1/object/public/audio/artists_profile_pic/AUDREY%20NUNA%2C%20EJAE%2C%20REI%20AMI.jpg'
where id = 'artist-kpop-demon-cast';
