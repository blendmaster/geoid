# simulated pose estimation of a globe from 2D points on the globe's surface.
#
# In real life, the points could be LEDs on the globe's surface for easy
# detection using thresholding and region centroids.
import cv2
import numpy as np
import random
from video import create_capture
from common import clock, draw_str

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
  norm_len = np.linalg.norm(norm_flat)

  #leng = np.sqrt(x**2 + y**2 + z**2)
  #print("%f" % leng)

  # translate
  return (x + x_g, y + y_g, z + z_g, norm_flat)

fov = 15
def K(width, height):

  fov_angle = np.arctan(height / width)

  fov_x = fov * np.cos(fov_angle)
  fov_y = fov * np.sin(fov_angle)

  fx = (width / 2) / np.tan(fov_x / 2)
  fy = (height / 2) / np.tan(fov_y / 2)

  # K
  # XXX how am I supposed to get square pixels with two different fov's? I dunno
  # how this is supposed to work
  return np.array([[fy , 0  , width / 2 ]   ,
                   [0  , fy , height / 2]   ,
                   [0  , 0  , 1         ]])

camera_world_pos = np.array([[0.0], [0.0], [0.0]]);

camera_rot_x = 0.
camera_rot_y = 0.
camera_rot_z = 0.

camera_rot = np.dot(rot_z(camera_rot_z),
                    np.dot(rot_y(camera_rot_y), rot_x(camera_rot_x)))

camera_rot_translate = np.hstack((camera_rot, camera_world_pos))

camera_extrinsics = np.linalg.inv(
    np.vstack((camera_rot_translate, np.array([0, 0, 0, 1]))))[0:3, :]

print camera_extrinsics
# radius, x, y, z, xrot (around x axis), yrot, zrot
radius = 1
globe_pose = (1, 0, 0, 30, 30, 30, 0)
model_globe = (1, 0, 0, 0, 0, 0, 0)

detector = cv2.ORB( nfeatures = 3500 )
FLANN_INDEX_KDTREE = 1
FLANN_INDEX_LSH    = 6
flann_params= dict(algorithm = FLANN_INDEX_LSH,
                   table_number = 6, # 12
                   key_size = 12,     # 20
                   multi_probe_level = 1) #2
matcher = cv2.FlannBasedMatcher(flann_params, {})  # bug : need to pass empty dict (#1329)

# prime/equator image is cenetered at lat lon (0,0)
# 2016x2016
# features extracted from it can then be changed to lat,lon pairs from image x, y
# easily
# then when features are matched in the camera image, they can be converted
# to model (globe) x, y, z and used in solvePnPRansac instead of 
# findHomography()
known = cv2.imread('prime_equator.jpg', 1)
ksize = known.shape[0] + 0.0
hsize = ksize / 2.
# masked with white, but just in case
mask = np.zeros_like(known[:, :, 1], dtype=np.uint8)
cv2.circle(mask, (int(hsize), int(hsize)), int(hsize), 255, -1)
known_keypoints, known_descriptors = detector.detectAndCompute(known, mask)
# translate all keypoints into x, y, z model globe
def known_globe_point(kp):
  xim, yim = kp.pt

  sinLat = (hsize - yim) / hsize
  latRad = np.arcsin(sinLat)
  lat = latRad * 180. / np.pi

  cosLatSinLon = (hsize - xim) / hsize
  sinLon = cosLatSinLon / np.cos(latRad)
  lonRad = np.arcsin(sinLon)

  lon = lonRad * 180. / np.pi

  x, y, z, _ = surface_point(lat, lon, model_globe)

  return (x, y, z)
  #print (x, xim / 1008. - 1)
  #print (y, 1 - yim / 1008.)

camera_intrinsics = K(ksize, ksize)

print len(known_keypoints)
vis = known
object_points = []
image_points = []
for kp in known_keypoints:
  p = kp.pt
  image_points.append(p)
  object_points.append(known_globe_point(kp))
obj = np.array(object_points, dtype=np.float32)
im = np.array(image_points, dtype=np.float32)

N = obj.shape[0]

rvec, tvec, inliers = cv2.solvePnPRansac(obj.reshape([1, N, 3]), im.reshape([1, N, 2]),
                                  camera_intrinsics, None 
                                  )

print rvec
print tvec

#if inliers != None:
  #for i in inliers:
    #xim, yim = image_points[i]
    #xg, yg = kp_pairs[i][0].pt

    #cv2.circle(vis, (int(xim), int(yim)), 2, (0, 255, 0), -1)
    #cv2.circle(vis, (w + int(xg), int(yg)), 2, (0, 255, 0), -1)
    #cv2.line(vis, (int(xim), int(yim)), (w + int(xg), int(yg)), (0, 255, 0))

[[est_x], [est_y], [est_z]] = tvec
[[est_rx], [est_ry], [est_rz]] = rvec

#estimated_globe_pose = (radius, est_x, est_y, est_z, est_rx, est_ry, est_rz)
d = 1. / np.tan(np.deg2rad(fov) / 2)
print d
estimated_globe_pose = (1, 0, 0, d + 1, 0, 0, 0)
# draw estimated outline of the globe
x_im_or, y_im_or = project((estimated_globe_pose[1], estimated_globe_pose[2], estimated_globe_pose[3]), camera_intrinsics, camera_extrinsics)
x_im_ed, y_im_ed = project((estimated_globe_pose[1] + estimated_globe_pose[0], estimated_globe_pose[2], estimated_globe_pose[3]), camera_intrinsics, camera_extrinsics)
radius_im = np.sqrt((x_im_ed - x_im_or)**2 + (y_im_ed - y_im_or)**2)
if radius_im < 3000:
  cv2.circle(vis, (int(x_im_or), int(y_im_or)), int(radius_im), (255, 255, 255), 1)

  ## draw equator/prime meridian
  for j in range(0, 361, 10):
    x, y, z, _ = surface_point(0, j, estimated_globe_pose)
    x_im, y_im = project((x, y, z), camera_intrinsics, camera_extrinsics)

    cv2.circle(vis, (int(x_im), int(y_im)), 1, (255, 255, 255), -1)

  for j in range(-90, 90, 10):
    x, y, z, _ = surface_point(j, 0, estimated_globe_pose)
    x_im, y_im = project((x, y, z), camera_intrinsics, camera_extrinsics)

    cv2.circle(vis, (int(x_im), int(y_im)), 1, (255, 255, 255), -1)

#known_descriptors = np.array(known_descriptors, dtype=np.uint8)
#for kp in known_keypoints:
  #pt = kp.pt
  #cv2.circle(known, (int(pt[0]), int(pt[1])), 3, (255, 0, 0), -1)

cv2.namedWindow('globe')
cv2.imshow('globe', vis)
cv2.waitKey(0)
sys.exit(1)

cam = create_capture(0)

cam.set(cv2.cv.CV_CAP_PROP_BRIGHTNESS, 0.5)
cam.set(cv2.cv.CV_CAP_PROP_EXPOSURE, -0.9)
cam.set(cv2.cv.CV_CAP_PROP_GAIN, 0)
cam.set(cv2.cv.CV_CAP_PROP_SATURATION, 1)
cv2.namedWindow('camera')

## grab training data
#us = cv2.imread('us.png', 1)
#canada = cv2.imread('canada.png', 1)
#centralam = cv2.imread('centralam.png', 1)

#us_kp, us_desc = detector.detectAndCompute(us, None)
#canada_kp, canada_desc = detector.detectAndCompute(canada, None)
#centralam_kp, centralam_desc = detector.detectAndCompute(centralam, None)

## lat, lon mapping from image points, assuming flat images
#us_rect = ((48.969, -118.780), (26.946, -85.834))
#canada_rect = ((64.597, -152.851), (39.502, -71.480))
#centralam_rect = ((31.26, -114.82), (2.8733, -67.379))

#def to_globe(im, imshape, rect):
  #x, y = im
  #height, width, _ = imshape

  #(lat1, lon1), (lat2, lon2) = rect

  #latheight = lat2 - lat1
  #lonwidth = lon2 - lon1

  #imwr = float(x) / float(width)
  #lon = lon1 + imwr * lonwidth

  #imhr = float(y) / float(height)
  #lat = lat1 + imhr * latheight

  #return (lat, lon)

#for i, kp in enumerate(us_kp):
  #if i % 100 != 0:
    #continue
  #lat, lon = to_globe(kp.pt, us.shape, us_rect)
  #cv2.circle(us, (int(kp.pt[0]), int(kp.pt[1])), 2, (255, 0, 0), -1)
  #draw_str(us, (int(kp.pt[0]), int(kp.pt[1])), '%.1f %.1f' % (lat, lon))

#cv2.imshow('camera', us)

#while True:
  #if 0xFF & cv2.waitKey(0) == 27:
    #sys.exit()

def filter_matches(kp1, kp2, matches, ratio = 0.75):
    mkp1, mkp2 = [], []
    for m in matches:
        if len(m) == 2 and m[0].distance < m[1].distance * ratio:
            m = m[0]
            mkp1.append( kp1[m.queryIdx] )
            mkp2.append( kp2[m.trainIdx] )
    p1 = np.float32([kp.pt for kp in mkp1])
    p2 = np.float32([kp.pt for kp in mkp2])
    kp_pairs = zip(mkp1, mkp2)
    return p1, p2, kp_pairs


while True:
  ret, img = cam.read()
  t = clock()

  h, w, _ = img.shape
  vis = np.zeros((ksize, w + ksize, 3), dtype=np.uint8)
  vis[0:h, 0:w, :] = img
  vis[0:ksize, w:w+ksize, :] = known

  img_keypoints, img_desc = detector.detectAndCompute(img, None)
  # XXX why does this happen
  if img_desc != None:

    raw_matches = matcher.knnMatch(known_descriptors, trainDescriptors=img_desc, k=2)
    p1, p2, kp_pairs = filter_matches(known_keypoints, img_keypoints, raw_matches)
    #raw_matches = matcher.knnMatch(img_desc, trainDescriptors=known_descriptors, k=2)
    #p1, p2, kp_pairs = filter_matches(img_keypoints, known_keypoints, raw_matches)

    object_points = []
    image_points = []
    for known_kp, img_kp in kp_pairs:
    #for img_kp, known_kp in kp_pairs:
      xim, yim = img_kp.pt
      xg, yg = known_kp.pt
      cv2.circle(vis, (int(xim), int(yim)), 2, (0, 0, 255), -1)
      cv2.circle(vis, (w + int(xg), int(yg)), 2, (0, 0, 255), -1)

      image_points.append(img_kp.pt)
      object_points.append(known_globe_point(known_kp))

    if len(image_points) > 50:
      obj = np.array(object_points, dtype=np.float32)
      im = np.array(image_points, dtype=np.float32)

      N = obj.shape[0]

      rvec, tvec, inliers = cv2.solvePnPRansac(obj.reshape([1, N, 3]), im.reshape([1, N, 2]),
                                        camera_intrinsics, None 
                                        )

      print rvec

      if inliers != None:
        for i in inliers:
          xim, yim = image_points[i]
          xg, yg = kp_pairs[i][0].pt

          cv2.circle(vis, (int(xim), int(yim)), 2, (0, 255, 0), -1)
          cv2.circle(vis, (w + int(xg), int(yg)), 2, (0, 255, 0), -1)
          cv2.line(vis, (int(xim), int(yim)), (w + int(xg), int(yg)), (0, 255, 0))

      [[est_x], [est_y], [est_z]] = tvec
      [[est_rx], [est_ry], [est_rz]] = rvec

      estimated_globe_pose = (radius, est_x, est_y, est_z, est_rx, est_ry, est_rz)
      # draw estimated outline of the globe
      x_im_or, y_im_or = project((estimated_globe_pose[1], estimated_globe_pose[2], estimated_globe_pose[3]), camera_intrinsics, camera_extrinsics)
      x_im_ed, y_im_ed = project((estimated_globe_pose[1] + estimated_globe_pose[0], estimated_globe_pose[2], estimated_globe_pose[3]), camera_intrinsics, camera_extrinsics)
      radius_im = np.sqrt((x_im_ed - x_im_or)**2 + (y_im_ed - y_im_or)**2)
      if radius_im < 3000:
        cv2.circle(vis, (int(x_im_or), int(y_im_or)), int(radius_im), (255, 255, 255), 1)

        ## draw equator/prime meridian
        for j in range(0, 361, 10):
          x, y, z, _ = surface_point(0, j, estimated_globe_pose)
          x_im, y_im = project((x, y, z), camera_intrinsics, camera_extrinsics)

          cv2.circle(vis, (int(x_im), int(y_im)), 1, (255, 255, 255), -1)

        for j in range(-90, 90, 10):
          x, y, z, _ = surface_point(j, 0, estimated_globe_pose)
          x_im, y_im = project((x, y, z), camera_intrinsics, camera_extrinsics)

          cv2.circle(vis, (int(x_im), int(y_im)), 1, (255, 255, 255), -1)
  dt = clock() - t

  draw_str(vis, (20, 20), 'time: %.1f ms' % (dt*1000))

  cv2.imshow('camera', vis)

  if 0xFF & cv2.waitKey(5) == 27:
    break

cam.release()
cv2.destroyAllWindows()

