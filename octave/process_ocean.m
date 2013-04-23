% process the ocean current dataset available from
% https://www.box.com/s/eiq3f82195yj3d5em23s , or
% the data used to make this video, in case the above link rotted:
% http://www.nasa.gov/topics/earth/features/perpetual-ocean.html
%
% Author: Steven Ruppert

% inputs: U.raw (horizontal), V.raw (Horizontal)
% binary float32s.
%
% 1440 x 720 x 50 (lon, lat, depth), but we'll only use the top depth (0)
%
% value is 0 where there is land, non-zero everywhere else

clear all
pkg load image

function slice = first_depth_slice(filename)
  fd = fopen(filename, 'r');

  data = fread(fd, Inf, 'float');

  slices = reshape(data, [1440, 720, 50]);

  slice = slices(:,:,1);

  % land needs to be scaled with nearest neighbor or smaller islands will
  % disappear, like cube
  water = imresize(slice != 0, [1024, 512], 'nearest');
  land = water == 0;

  % resize to powers of two for ease of use in textures
  % octave's imresize uses blinterp by default
  slice = imresize(slice, [1024, 512]);
  slice(land) = 0;

  % the ocean data is rotated clockwise for some reason, so correct
  slice = rot90(slice);
end

horizontal = first_depth_slice('U.raw');
vertical   = first_depth_slice('V.raw');

% for extreme cheapness, we're gonna pack this 2 dimensional vector data into
% RGB channels in a single texture, with loss of accuracy.
%
% OpenGL ES 2.0 does support floating point textures, but let's try this for now.
%
% R: horizontal velocity, from 0 to 255
% G: vertical   velocity, from 0 to 255
% B: 0 if on land, 255 otherwise

% 0.5 should correspond with zero
function scaled = rescale(values)
  max_abs = max(max(abs(values)));

  scale_by = 0.5 / max_abs;

  scaled_around_zero = values .* scale_by;

  scaled = scaled_around_zero .+ 0.5;
end

s_h = rescale(horizontal);
s_v = rescale(vertical);
water = vertical != 0;

% zero out lane
s_h(horizontal == 0) = 0;
s_v(vertical   == 0) = 0;

texture = zeros(512, 1024, 3);
texture(:, :, 1) = s_h;
texture(:, :, 2) = s_v;
texture(:, :, 3) = water;

imwrite(texture, 'ocean-current.png');
