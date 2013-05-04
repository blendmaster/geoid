% read the ocean current dataset downloaded by `download-ocean.sh` and
% resize to powers of two matrices
%
% Author: Steven Ruppert

% data_name is 'UVEL' or 'VVEL'
function data = resized_data(filename, data_name)
  file = netcdf(filename, 'r');

  % data is flipped in image coordinates
  data = flipud(reshape(file{data_name}(:), [720 1440]));

  % land needs to be scaled with nearest neighbor or smaller islands will
  % disappear, like cuba
  water = imresize(data != 0, [512, 1024], 'nearest');
  land = water == 0;

  % resize to powers of two for ease of use in textures
  % octave's imresize uses blinterp by default
  data = imresize(data, [512, 1024]);
  data(land) = 0;
end
