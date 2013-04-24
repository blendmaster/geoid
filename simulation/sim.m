% octave version
%
width = 640;
height = 480;

fov = 66.41; % of the rear camera, in degrees, across the diagonal

fov_angle = atan(height / width);

fov_x = fov * cos(fov_angle);
fov_y = fov * sin(fov_angle);

fx = (width / 2) / tan(fov_x / 2);
fy = (height / 2) / tan(fov_y / 2);

K = [fy, 0, width/2;
     0, fy, height/2;
     0  0   1];

ax = 0;
ay = 30 / 180 * pi;
az = 0;

% radians
Rx = [ 1 0 0; 0 cos(ax) -sin(ax); 0 sin(ax) cos(ax) ];
Ry = [ cos(ay) 0 sin(ay); 0 1 0; -sin(ay) 0 cos(ay) ];
Rz = [ cos(az) -sin(az) 0; sin(az) cos(az) 0; 0 0 1 ];
R_c_w = Rz * Ry * Rx;

t_c_w = [0;0;0];

H_c_w = [R_c_w t_c_w; 0 0 0 1];
H_w_c = inv(H_c_w);

% Extrinsic camera parameter matrix
Mext = H_w_c(1:3,:);

transform = K * Mext

% radius, x, y, z, xrot (around x axis), yrot, zrot
globe_pose = [0.5, 0, 0, 0.6, 0, 0, 0];

function p = surface_point(lat, lon, globe_pose)
  radius = globe_pose(1);

  x_c = globe_pose(2);
  y_c = globe_pose(3);
  z_c = globe_pose(4);

  xrot = globe_pose(5);
  yrot = globe_pose(6);
  zrot = globe_pose(7);

  % positive lats in north hemisphere
  y = radius * sin(-lat / 180 * pi);

  y_radius = radius * cos(-lat / 180 * pi);

  % positive lons to the east
  x = y_radius * sin(lon / 180 * pi);
  z = y_radius * cos(lon / 180 * pi);

  p = [x + x_c, y + y_c, z + z_c];
end

% points on a globe
P_w = zeros(4, 19 * 19);
n = 1;
for i = -9:9
  for j = -9:9
    p = surface_point(i * 10, j * 10, globe_pose);

    P_w(1, n) = p(1);
    P_w(2, n) = p(2);
    P_w(3, n) = p(3);
    P_w(4, n) = 1; % homogenous

    n = n + 1;
  end
end

% perspective transform
p_img = K * Mext * P_w;
p_img(1,:) = p_img(1,:) ./ p_img(3,:);
p_img(2,:) = p_img(2,:) ./ p_img(3,:);


I = zeros(height,width);
imshow(I, []);
hold on

scatter(p_img(1, :), p_img(2, :));
