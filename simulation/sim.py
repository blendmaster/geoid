# simulated pose estimation of a globe from 2D points on the globe's surface.
#
# In real life, the points could be LEDs on the globe's surface for easy
# detection using thresholding and region centroids.
import cv2
import numpy as np

# Nexus S rear camera, preview mode in OpenCV
width  = 640.0
height = 480.0

def project(point3d, camera_intrinsics, camera_extrinsics):
  x, y, z = point3d
  projection_matrix = np.dot(camera_intrinsics, camera_extrinsics)
  [[x1], [x2], [x3]] = np.dot(projection_matrix, np.array([[x], [y], [z], [1]]))
  x_im = x1 / x3
  y_im = x2 / x3
  return (x_im, y_im)

def rot_z(angle):
  cost = np.cos(np.deg2rad(angle))
  sint = np.sin(np.deg2rad(angle))
  return np.array([[cost, -sint, 0],
                   [sint, cost, 0],
                   [0, 0, 1]])

def rot_y(angle):
  cost = np.cos(np.deg2rad(angle))
  sint = np.sin(np.deg2rad(angle))
  return np.array([[cost, 0, sint],
                   [0, 1, 0 ],
                   [-sint, 0, cost]])

def rot_x(angle):
  cost = np.cos(np.deg2rad(angle))
  sint = np.sin(np.deg2rad(angle))
  return np.array([[1, 0, 0],
                   [0, cost, -sint],
                   [0, sint, cost]])

# globe radius is 1

def surface_point(lat, lon, globe_pose):
  """The 3D coordinates of a latitude/longitude surface point on the globe."""
  radius, x_g, y_g, z_g, xrot, yrot, zrot = globe_pose

  # positive lats in north hemisphere
  y = radius * np.sin(np.deg2rad(-lat))

  y_radius = radius * np.cos(np.deg2rad(lat))

  # positive lons to the east
  x = y_radius * np.sin(np.deg2rad(lon))
  z = y_radius * np.cos(np.deg2rad(lon))

  # rotate
  rot = np.dot(rot_x(xrot), np.dot(rot_y(yrot), rot_z(zrot)))
  transformed = np.dot(rot, np.array([[x], [y], [z]]))

  [[x], [y], [z]] = transformed

  # translate
  return (x + x_g, y + y_g, z + z_g)

def simulated_image(points, camera_intrinsics, camera_extrinsics, globe_pose):
  """From a camera pose and globe pose in world coordinates, an image
  containing the projected points on the globe, with a bit of noise and
  extraneous parts."""

  img = np.zeros((height, width, 3), np.uint8)

  #points = []
  #for x in range(-10, 11, 2):
    #for y in range(-10, 11, 2):
      #points.append((x / 10.0, y / 10.0, 1,
        #(((x + 10) / 20.0) * 255, ((y + 10) / 20.0 * 255), 255)))

  for point in points:
    lat, lon, (r,g,b) = point

    x, y, z = surface_point(point[0], point[1], globe_pose)

    #x, y, z, (r, g, b) = point

    x_im, y_im = project((x, y, z), camera_intrinsics, camera_extrinsics)
    # TODO only draw if facing camera

    #print("x: %f, y: %f" % (x_im, y_im))

    # peturb randomly

    # draw on image
    cv2.circle(img,
               (int(x_im), int(y_im)), # center
               3, # radius
               (b, g, r), # color, in opencv's order
               int(-1) # stroke thickness (negative means filled in)
               )

  #for some amount of randomness:
    #add random blotches

  #add noise to img

  return img

def estimated_pose(camera_intrinsics, camera_extrinsics, image):
  """The estimated pose from an image, using opencv"""

  # remove noise
  cv.open(image)

  # find centers of points
  centers = cv.centers(stuff)

  # estimate using 3PnP method and RANSAC to throw out outliers
  pose = cv.solvePnP(stuff)

  return pose

def simulate(camera_intrinsics, camera_extrinsics, globe_pose, points):
  """Simulate capturing an image of the globe and its points, then estimating
  the pose of the globe from the image."""

  image = simulated_image(points,
                          camera_intrinscs,
                          camera_extrinsics,
                          globe_pose)

  estimated_globe_pose = estimated_pose(camera_intrinsics,
                                        camera_extrinsics,
                                        gmage)

  # convert binary image to rgb to show pose estimates
  cv.cvtColor(stuff)

  # draw real and estimated pose's outline on image in different colors
  cv.Circle(stuff)
  cv.Circle(stuff)

  cv2.namedWindow('w')
  cv2.imshow('w', image)
  cv2.waitKey()

fov = 66.41 # of the rear camera, in degrees, across the diagonal

fov_angle = np.arctan(height / width)

fov_x = fov * np.cos(fov_angle)
fov_y = fov * np.sin(fov_angle)

fx = (width / 2) / np.tan(fov_x / 2)
fy = (height / 2) / np.tan(fov_y / 2)

# K
# XXX how am I supposed to get square pixels with two different fov's? I dunno
# how this is supposed to work
camera_intrinsics = np.array([[fy, 0, width / 2, 0],
                              [0, fy, height / 2, 0],
                              [0, 0, 1, 0]])

camera_extrinsics = np.array([[1, 0, 0, 0],
                              [0, 1, 0, 0],
                              [0, 0, 1, 0],
                              [0, 0, 0, 1]])

# radius, x, y, z, xrot (around x axis), yrot, zrot
globe_pose = (0.5, 0, 0, 0.7, 0, 0, 0)

# points on a globe by latitude and longitude, and color (rgb)
points = [
  (51.5171, -0.1062, (255, 255, 255)), # london
  (28.6667, 77.2167, (255, 0, 0)), # new delhi
  (31.7833, 35.2167, (0, 255, 0)),  # jerusalem
  (40.7142, -74.0064, (0, 0, 255)), # new york
  (36.1430, -5.3530, (127, 0, 0)), # carthage
  (-33.9767, 18.4244, (255, 0, 255)), # cape town
  (-22.9083, -43.2436, (255, 255, 0)), # rio de janeiro
]

# test points
#for i in range(-90, 91, 10):
  #for j in range(-90, 91, 10):
    #points.append((i, j, ((i + 90.0) / 180.0 * 255, (j + 90.0) / 180.0 * 255, 255)))


i = simulated_image(points, camera_intrinsics, camera_extrinsics, globe_pose)

# draw outline of globe
x_im_or, y_im_or = project((globe_pose[1], globe_pose[2], globe_pose[3]), camera_intrinsics, camera_extrinsics)
x_im_ed, y_im_ed = project((globe_pose[1] + globe_pose[0], globe_pose[2], globe_pose[3]), camera_intrinsics, camera_extrinsics)

radius_im = np.sqrt((x_im_ed - x_im_or)**2 + (y_im_ed - y_im_or)**2)

cv2.circle(i, (int(x_im_or), int(y_im_or)), int(radius_im), (255, 255, 255), 1)
cv2.imshow('w', i)

#simulate(camera_intrinscs, camera_extrinsics, globe_pose, points)
