% each timeslice is 1024x512 and has 2 fields (U and V) so we can pack 16
% timeslices into a 2048x2048 RGBA png, the largest safe size for WebGL
% textures (i.e. supported by 99% of browsers)
%
% time start is a serial date number
function packed = pack16(time_start)
  packed = [...
    pack2(time_start), pack2(addtodate(time_start, 2, 'month'));
    pack2(addtodate(time_start, 4, 'month')), pack2(addtodate(time_start, 6, 'month'));
    pack2(addtodate(time_start, 8, 'month')), pack2(addtodate(time_start, 10, 'month'));
    pack2(addtodate(time_start, 12, 'month')), pack2(addtodate(time_start, 14, 'month'));
  ];
end
