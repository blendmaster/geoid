% Pack 2 timeslices into a single 1024x512 RGBA (512, 1024, 4) matrix.
%
% time start is a serial date number
function packed = pack2(time_start)
  packed = uint8(zeros(512, 1024, 4));

  uvel1 = packed_field(resized_data(sprintf('uvel-%s.nc',
                                            datestr(time_start, 'yyyymm')),
                                    'UVEL'));
  vvel1 = packed_field(resized_data(sprintf('vvel-%s.nc',
                                            datestr(time_start, 'yyyymm')),
                                    'VVEL'));

  next = addtodate(time_start, 1, 'month');
  uvel2 = packed_field(resized_data(sprintf('uvel-%s.nc',
                                            datestr(next, 'yyyymm')),
                                    'UVEL'));
  vvel2 = packed_field(resized_data(sprintf('vvel-%s.nc',
                                            datestr(next, 'yyyymm')),
                                    'VVEL'));
  packed(:, :, 1) = uvel1;
  packed(:, :, 2) = vvel1;
  packed(:, :, 3) = uvel2;
  packed(:, :, 4) = vvel2;
end
