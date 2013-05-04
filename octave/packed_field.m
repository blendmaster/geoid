% Author: Steven Ruppert
%
% Since we need a lot of timeslices for animation, instead of loading
% 2 floating-point textures for every timeslice (and losing the free linear
% interpolation that openGL gives regular textures but not FP ones), we're
% going to pack the vector field
% into Uint8 RGBA channels.
%
% This obviously loses a lot of accuracy since most of the velocities are close
% to 0, but because geoid is basically an art project (like the perpetual ocean
% video) and small details aren't visible from far away anyway, we don't care
% that much.
%
% To stave off accuracy loss slightly, bin velocities on a log scale.
%
% each timeslice is 1024x512 and has 2 fields (U and V) so we can pack 16
% timeslices into a 2048x2048 RGBA png.
%
% There are 20 years of data from ecco2, or 240 timeslices, so we can fit all
% that into 16 images.
%
% Depending on how well they compress, github might not hate us for hosting all
% of them in the repo.

% pack values into uint8 field.
function packed = packed_field(values)

  % in order for the log scale to work, we need to know how to rescale
  % the range back to logspace in opengl, so we want to keep the scaling constant
  % for simplicity.
  %
  % histogram observation shows that almost all values in logspace are above
  % -10, so threshold there.
  threshold = exp(-10);

  packed = values;
  packed(abs(values) < threshold) = 0;

  max_abs = max(max(abs(packed)));

  % to [-1, 1]
  scaled_around_zero = packed ./ max_abs;

  pos = scaled_around_zero(scaled_around_zero > 0);
  % to [negative, 0]
  posl = log(pos);
  % to [0, 127]
  pospacked = (posl + 10) / 10 * 128;

  neg = scaled_around_zero(scaled_around_zero < 0);
  negl = log(-neg);
  % to [128, 255]
  negpacked = (negl + 10) / 10 * 128 + 128;

  % put it all together
  posidx = packed > 0;
  negidx = packed < 0;

  packed(posidx) = pospacked;
  packed(negidx) = negpacked;

  % turn it into a uint8array
  packed = uint8(floor(packed));
end

