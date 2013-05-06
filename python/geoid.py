# python globe pose estimator from training images
import cv2
import numpy as np
import random
from video import create_capture
from common import clock, draw_str
import sys
import argparse
import os

# arg parsing stuff

parser = argparse.ArgumentParser(description='Augment globes through your camera.')
parser.add_argument('directory',
                    help='directory to find 450x450 training images, named "LATxLON.jpg".')
parser.add_argument('-c', '--camera',
                    help='camera input number to use, default the first camera.',
                    type=int, default=0)
parser.add_argument('-v', '--video',
                    help='Instead of webcam, use a prerecorded video file.',)
parser.add_argument('--skip-frames',
                    help='Skip every N frames (if the video is slow)',
                    type=int, default=0)
args = parser.parse_args()

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
  """The 3D coordinates of a latitude/longitude surface point on the globe, as
  well as the normal vector."""
  radius, x_g, y_g, z_g, xrot, yrot, zrot = globe_pose

  # positive lats in north hemisphere
  y = radius * np.sin(np.deg2rad(lat))

  y_radius = radius * np.cos(np.deg2rad(lat))

  # positive lons to the east
  x = y_radius * np.sin(np.deg2rad(-lon))
  z = y_radius * np.cos(np.deg2rad(-lon))

  norm = np.array([[x], [y], [z]])
  norm_len = np.linalg.norm(norm)
  norm = norm / norm_len

  # rotate
  rot = np.dot(rot_x(xrot), np.dot(rot_y(yrot), rot_z(zrot)))
  transformed = np.dot(rot, np.array([[x], [y], [z]]))

  [[x], [y], [z]] = transformed
  [[xn], [yn], [zn]] = np.dot(rot, norm)

  norm_flat = np.array([xn, yn, zn])

  # translate
  return (x + x_g, y + y_g, z + z_g, norm_flat)

fov = 15

def K(width, height):
  f = (width / 2.) / np.tan(np.deg2rad(fov) / 2.)
  return np.array([[f , 0  , width / 2 ]   ,
                   [0  , f , height / 2]   ,
                   [0  , 0  , 1         ]])

# radius, x, y, z, xrot (around x axis), yrot, zrot
radius = 1
globe_pose = (1, 0, 0, 30, 30, 30, 0)
model_globe = (1, 0, 0, 0, 0, 0, 0)

# we don't want too many points from training, but plenty from the camera
train_detector = cv2.ORB( nfeatures = 400 )
image_detector = cv2.ORB( nfeatures = 1500 )
FLANN_INDEX_KDTREE = 1
FLANN_INDEX_LSH    = 6
flann_params= dict(algorithm = FLANN_INDEX_LSH,
                   table_number = 6, # 12
                   key_size = 12,     # 20
                   multi_probe_level = 1) #2
matcher = cv2.FlannBasedMatcher(flann_params, {})  # bug : need to pass empty dict (#1329)

# training images pointing at globe center from different angles
# features extracted from it can then be changed to lat,lon pairs from image x, y
# easily
# then when features are matched in the camera image, they can be converted
# to model (globe) x, y, z and used in solvePnPRansac instead of
# findHomography()
# all training images are this size
ksize = 450.
hsize = 225. # half size

# we only want to train the center 45x45 degree patch, since the edges aren't
# that useful and will overlap with other training images
mask = np.zeros([ksize, ksize], dtype=np.uint8)
cv2.circle(mask, (int(hsize), int(hsize)), int(hsize / 2.), 255, -1)

# translate all keypoints into x, y, z model globe, centered at some lat, lon
def known_globe_point(p, centerLat, centerLon):
  xim, yim = p

  sinLat = (hsize - yim) / hsize
  latRad = np.arcsin(sinLat)
  lat = np.rad2deg(latRad)

  cosLatSinLon = (hsize - xim) / hsize
  sinLon = cosLatSinLon / np.cos(latRad)
  lonRad = np.arcsin(sinLon)

  lon = np.rad2deg(lonRad)

  xn, yn, zn, _ = surface_point(lat, lon, model_globe)

  xrot = -centerLat
  yrot = centerLon

  rot = np.dot(rot_x(xrot), rot_y(yrot))
  [[x], [y], [z]] = np.dot(rot, np.array([[xn], [yn], [zn]]))

  return (x, y, z)

import re
import random

class Known:
  def __init__(self, img, lat, lon, kp, desc, i, j):
    self.img = img
    self.lat = lat
    self.lon = lon
    self.kp = kp
    self.desc = desc
    self.i = i
    self.j = j

    [[[b, g, r]]] = cv2.cvtColor(np.array([[[random.randint(0, 255),
                                                random.randint(127, 255),
                                                255]]], dtype=np.uint8),
                                    cv2.COLOR_HSV2BGR)

    self.color = (int(b), int(g), int(r))

known = []
files = os.listdir(args.directory)

# make grid of training images for display
grid = 100
fgrid = 100.
grid_size = np.ceil(np.sqrt(len(files))) * grid
grid_img = np.zeros([grid_size, grid_size, 3], dtype=np.uint8)
i = 0
j = 0

for f in files:
  print("training on %s" % f)
  img = cv2.imread("%s/%s" % (args.directory, f), 1)

  m = re.match('([\d-]+)x([\d-]+)\.jpg', f)
  lat, lon = int(m.group(1)), int(m.group(2))

  kp, desc = train_detector.detectAndCompute(img, mask)

  # add to grid
  grid_img[i:(i + grid), j:(j + grid), :] = cv2.resize(img, dsize=(grid, grid),
                                                       interpolation=cv2.INTER_AREA)

  known.append(Known(img, lat, lon, kp, desc, i, j))

  j = j + grid
  if j == grid_size:
    j = 0
    i = i + grid

print("done training!")

cv2.imshow('training', grid_img)

if args.video != None:
  print("opening video file %s..." % args.video)
  cam = cv2.VideoCapture(args.video)
else:
  cam = create_capture(args.camera)

cv2.namedWindow('camera')

def filter_matches(kp1, kp2, matches, ratio = 0.75):
    mkp1, mkp2 = [], []
    for m in matches:
        if len(m) == 2 and m[0].distance < m[1].distance * ratio:
            m = m[0]
            mkp1.append( kp1[m.queryIdx] )
            mkp2.append( kp2[m.trainIdx] )
    return zip(mkp1, mkp2)

last_rvec = np.array([[0.], [0.], [0.]])
last_tvec = np.array([[0.], [0.], [2.]])

while True:
  img = None
  for i in range(args.skip_frames + 1):
    ret, img = cam.read()
  if img == None: break
  t = clock()

  h, w, _ = img.shape
  camera_intrinsics = K(w, h)

  vis = img
  g = grid_img.copy()

  img_keypoints, img_desc = image_detector.detectAndCompute(img, None)
  if img_desc != None: # if there are any keypoints

    object_points = []
    image_points = []
    point_colors = []
    grid_points = []

    for know in known:
      raw_matches = matcher.knnMatch(know.desc, trainDescriptors=img_desc, k=2)

      kp_pairs = filter_matches(know.kp, img_keypoints, raw_matches)
      for known_kp, img_kp in kp_pairs:
        xim, yim = img_kp.pt
        xg, yg = known_kp.pt

        # draw kp on output
        cv2.circle(vis, (int(xim), int(yim)), 2, know.color, -1)

        # draw original on grid
        p = (int((xg / ksize * fgrid) + know.j),
             int((yg / ksize * fgrid) + know.i))
        grid_points.append(p)
        cv2.circle(g, p, 2, know.color, -1)

        image_points.append(img_kp.pt)
        object_points.append(known_globe_point(known_kp.pt, know.lat, know.lon))
        point_colors.append(know.color)

    if len(image_points) > 20:
      obj = np.array(object_points, dtype=np.float32)
      im = np.array(image_points, dtype=np.float32)

      N = obj.shape[0]

      rvec, tvec, inliers = cv2.solvePnPRansac(
        obj.reshape([1, N, 3]),
        im.reshape([1, N, 2]),
        camera_intrinsics,
        distCoeffs=None, # assuming no distortion
        rvec=last_rvec,
        tvec=last_tvec,
        useExtrinsicGuess=True,
        flags=cv2.CV_EPNP
      )

      if inliers != None:
        # assume pose is relatively good, so use it for next round
        last_rvec = rvec
        last_tvec = tvec

        # block out globe
        # find radius
        norvec = np.array([[0.0], [0.0], [0.0]])
        [[[x_c, y_c]]], _ = cv2.projectPoints(np.array([(0., 0., 0.)]), norvec, tvec, camera_intrinsics, None)
        [[[x_n, y_n]]], _ = cv2.projectPoints(np.array([(0., 1., 0.)]), norvec, tvec, camera_intrinsics, None)

        radius = int(np.sqrt((x_c - x_n)**2 + (y_c - y_n)**2))

        cv2.circle(vis, (int(x_c), int(y_c)), radius, (255, 0, 0), -1)

        for i in inliers:
          xim, yim = image_points[i]
          color = point_colors[i]
          p = grid_points[i]

          cv2.circle(vis, (int(xim), int(yim)), 5, (0, 0, 0), -1)
          cv2.circle(vis, (int(xim), int(yim)), 2, color, -1)

          cv2.circle(g, p, 5, (0,0,0), 1)

        #[[est_x], [est_y], [est_z]] = tvec
        #[[est_rx], [est_ry], [est_rz]] = rvec
        #pose = (1., est_x, est_y, est_z, est_rz, est_ry, est_rz)
        #x, y, z, norm = surface_point(0, 0, pose)
        #print ""
        #print "(0, 0):", x, y, z, norm
        #print "origin: ", est_x, est_y, est_z
        #print "rot: ", np.rad2deg(rvec)
        #print "dot(eye, norm):", np.dot(np.array([-est_x, -est_y, -est_z]), norm)

        ## draw equator/prime meridian
        for j in range(-90, 90, 5):
          x, y, z, _ = surface_point(0, j, model_globe)
          [[[x_im, y_im]]], _ = cv2.projectPoints(np.array([(x, y, z)]), rvec, tvec, camera_intrinsics, None)

          x2, y2, z2, _ = surface_point(0, j + 5, model_globe)
          [[[x_im2, y_im2]]], _ = cv2.projectPoints(np.array([(x2, y2, z2)]), rvec, tvec, camera_intrinsics, None)

          cv2.line(vis, (int(x_im), int(y_im)), (int(x_im2), int(y_im2)), (255, 0, 255), 2)

        # prime meridian
        for j in range(-90, 90, 5):
          x, y, z, _ = surface_point(j, 0, model_globe)
          [[[x_im, y_im]]], _ = cv2.projectPoints(np.array([(x, y, z)]), rvec, tvec, camera_intrinsics, None)
          x2, y2, z2, _ = surface_point(j + 5, 0, model_globe)
          [[[x_im2, y_im2]]], _ = cv2.projectPoints(np.array([(x2, y2, z2)]), rvec, tvec, camera_intrinsics, None)

          cv2.line(vis, (int(x_im), int(y_im)), (int(x_im2), int(y_im2)), (0, 255, 255), 2)

        ## draw edge of globe
        for j in range(0, 360, 5):
          x, y, z, _ = surface_point(j, 90, model_globe)
          [[[x_im, y_im]]], _ = cv2.projectPoints(np.array([(x, y, z)]), rvec, tvec, camera_intrinsics, None)
          x2, y2, z2, _ = surface_point(j + 5, 90, model_globe)
          [[[x_im2, y_im2]]], _ = cv2.projectPoints(np.array([(x2, y2, z2)]), rvec, tvec, camera_intrinsics, None)

          cv2.line(vis, (int(x_im), int(y_im)), (int(x_im2), int(y_im2)), (255, 255, 255), 2)
  dt = clock() - t

  draw_str(vis, (20, 20), 'time: %.1f ms' % (dt*1000))

  cv2.imshow('camera', vis)
  cv2.imshow('training', g)

  if 0xFF & cv2.waitKey(5) == 27:
    break

cam.release()
cv2.destroyAllWindows()

