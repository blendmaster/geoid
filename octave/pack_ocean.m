% pack all the data downloaded into PNG files.
pkg load image

last = datenum(2012, 12, 01);

current = datenum(1993, 01, 02);
n = 0;
% there are 240 timeslices for an even 15 images,
% uncompressed, they're 8mb each for a total of 1920 mb
while current < last
  printf('packing image %02i\n', n);
  data = pack16(current);
  
  % XXX octave flips the alpha channel when saving images (and reading them), so
  % unflip it before write
  data(:, :, 4) = 255 - data(:, :, 4);

  imwrite(data, sprintf('packed-%02i.png', n));

  n = n + 1;
  current = addtodate(current, 16, 'month');
end
