# simulated pose estimation of a globe from 2D points on the globe's surface.
#
# In real life, the points could be LEDs on the globe's surface for easy
# detection using thresholding and region centroids.
import cv2
import numpy as np

radius = 1

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

def surface_point(lat, lon, globe_pose):
  """The 3D coordinates of a latitude/longitude surface point on the globe."""
  x_g, y_g, z_g, xrot, yrot, zrot = globe_pose

  y = np.sin(np.deg2rad(lat))

  y_radius = np.cos(np.deg2rad(lat))

  x = y_radius * np.cos(np.deg2rad(lon))
  z = y_radius * np.sin(np.deg2rad(lon))

  # rotate
  rot = np.dot(rot_z(zrot), np.dot(rot_y(yrot), rot_x(xrot)))
  transformed = np.dot(rot, np.array([[x], [y], [z]]))

  [[x], [y], [z]] = transformed

  # translate
  return (x + x_g, y + y_g, z + z_g)

def simulated_image(points, camera_intrinsics, camera_extrinsics, globe_pose):
  """From a camera pose and globe pose in world coordinates, an image
  containing the projected points on the globe, with a bit of noise and
  extraneous parts."""

  img = np.zeros((640, 480, 3), np.uint8)

  projection_matrix = stuff

  for point in points:
    world_point = surface_point(point[0], point[1], globe_pose)
    img_point = cv.mult(world_point, projection_matrix)

    # peturb randomly

    # draw on image
    cv.Circle(img, center, etc)

  #for some amount of randomness:
    #add random blotches

  #add noise to img

  return img

def estimated_pose(camera_intrinsics, camera_extrinsics, image):
  """The estimated pose from an image, using opencv"""

  # remove noise
  cv.open(image)

  # find centers of points
  centers =cv.centers(stuff)

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
                                        image)

  # convert binary image to rgb to show pose estimates
  cv.cvtColor(stuff)

  # draw real and estimated pose's outline on image in different colors
  cv.Circle(stuff)
  cv.Circle(stuff)

  cv.imshow(image)

# Nexus S rear camera, preview mode in OpenCV
width  = 640
height = 480

camera_fov = 66.41 # of the rear camera, in degrees, across the diagonal

#camera_intrinsics = stuff

## rotation, translation
#camera_extrinsics = stuff

#globe_pose = stuff

## points on a globe by latitude and longitude
#points = stuff

#simulate(camera_intrinscs, camera_extrinsics, globe_pose, points)
