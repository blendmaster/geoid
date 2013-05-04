% generate a binary image for land/water, used for edge cases.
%
% Author: Steven Ruppert

% assuming the land doesn't change...
data = resized_data('uvel-201101.nc', 'UVEL');

imwrite(data == 0, 'land-mask.png');
% could also process in gimp later to create a smaller indexed PNG.

