% pack all the data downloaded into PNG files.
pkg load image
fst = pack16(datenum(2011, 01, 01));
% XXX octave flips the alpha channel when saving images (and reading them), so
% unflip it before write
fst(:, :, 4) = 255 - fst(:, :, 4);
imwrite(fst, 'packed16.png');
