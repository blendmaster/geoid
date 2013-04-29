# python globe pose estimator from training images
import cv2
import numpy as np
import random
from video import create_capture
from common import clock, draw_str

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
  norm_len = np.linalg.norm(norm_flat)

  #leng = np.sqrt(x**2 + y**2 + z**2)
  #print("%f" % leng)

  # translate
  return (x + x_g, y + y_g, z + z_g, norm_flat)

fov = 15
def K(width, height):
  f = (width / 2.) / np.tan(np.deg2rad(fov) / 2.)
  # K
  # XXX how am I supposed to get square pixels with two different fov's? I dunno
  # how this is supposed to work
  return np.array([[f , 0  , width / 2 ]   ,
                   [0  , f , height / 2]   ,
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

# radius, x, y, z, xrot (around x axis), yrot, zrot
radius = 1
globe_pose = (1, 0, 0, 30, 30, 30, 0)
model_globe = (1, 0, 0, 0, 0, 0, 0)

detector = cv2.ORB( nfeatures = 1500 )
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
known = cv2.imread('prime_equator.jpg', 1)
eur_known = cv2.imread('54x15.jpg', 1)

# all training images are this size
ksize = 640.
hsize = 320.

# masked with white, but just in case
mask = np.zeros_like(known[:, :, 1], dtype=np.uint8)
cv2.circle(mask, (int(hsize), int(hsize)), int(hsize), 255, -1)
known_keypoints, known_descriptors = detector.detectAndCompute(known, mask)
eur_kp, eur_desc = detector.detectAndCompute(eur_known, mask)

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

#print known_globe_point((0, 320), 90., 0)
##print surface_point(90., 15., model_globe)
#sys.exit()

cam = create_capture(0)

cam.set(cv2.cv.CV_CAP_PROP_BRIGHTNESS, 0.5)
cam.set(cv2.cv.CV_CAP_PROP_EXPOSURE, -0.9)
cam.set(cv2.cv.CV_CAP_PROP_GAIN, 0)
cam.set(cv2.cv.CV_CAP_PROP_SATURATION, 1)
cv2.namedWindow('camera')

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
  camera_intrinsics = K(w, h)

  vis = np.zeros((ksize, w + ksize, 3), dtype=np.uint8)
  vis[0:h, 0:w, :] = img
  vis[0:ksize, w:w+ksize, :] = known

  img_keypoints, img_desc = detector.detectAndCompute(img, None)
  # XXX why does this happen
  if img_desc != None:

    raw_matches = matcher.knnMatch(known_descriptors, trainDescriptors=img_desc, k=2)
    p1, p2, kp_pairs = filter_matches(known_keypoints, img_keypoints, raw_matches)

    raw_matches = matcher.knnMatch(eur_desc, trainDescriptors=img_desc, k=2)
    p1, p2, eur_pairs = filter_matches(eur_kp, img_keypoints, raw_matches)

    object_points = []
    image_points = []
    for known_kp, img_kp in kp_pairs:
    #for img_kp, known_kp in kp_pairs:
      xim, yim = img_kp.pt
      xg, yg = known_kp.pt
      cv2.circle(vis, (int(xim), int(yim)), 2, (0, 0, 255), -1)
      cv2.circle(vis, (w + int(xg), int(yg)), 2, (0, 0, 255), -1)

      image_points.append(img_kp.pt)
      # europe
      object_points.append(known_globe_point(known_kp.pt, 0., 0.))

    for known_kp, img_kp in eur_pairs:
    #for img_kp, known_kp in kp_pairs:
      xim, yim = img_kp.pt
      #xg, yg = known_kp.pt
      cv2.circle(vis, (int(xim), int(yim)), 2, (0, 0, 255), -1)
      #cv2.circle(vis, (w + int(xg), int(yg)), 2, (0, 0, 255), -1)

      image_points.append(img_kp.pt)
      # europe
      object_points.append(known_globe_point(known_kp.pt, 54., 15.))

    print len(image_points)

    if len(image_points) > 50:
      obj = np.array(object_points, dtype=np.float32)
      im = np.array(image_points, dtype=np.float32)

      N = obj.shape[0]

      rvec, tvec, inliers = cv2.solvePnPRansac(obj.reshape([1, N, 3]), im.reshape([1, N, 2]),
                                        camera_intrinsics, None,
                                        flags=cv2.CV_EPNP
                                        )

      if inliers != None:
        for i in inliers:
          xim, yim = image_points[i]
          #xg, yg = kp_pairs[i][0].pt

          cv2.circle(vis, (int(xim), int(yim)), 2, (0, 255, 0), -1)
          #cv2.circle(vis, (w + int(xg), int(yg)), 2, (0, 255, 0), -1)
          #cv2.line(vis, (int(xim), int(yim)), (w + int(xg), int(yg)), (0, 255, 0))

        [[est_x], [est_y], [est_z]] = tvec
        [[est_rx], [est_ry], [est_rz]] = rvec

        ## draw equator/prime meridian
        for j in range(-90, 91, 5):
          x, y, z, _ = surface_point(0, j, model_globe)
          [[[x_im, y_im]]], _ = cv2.projectPoints(np.array([(x, y, z)]), rvec, tvec, camera_intrinsics, None)

          cv2.circle(vis, (int(x_im), int(y_im)), 1, (255, 255, 255), -1)

        for j in range(-90, 91, 5):
          x, y, z, _ = surface_point(j, 0, model_globe)
          [[[x_im, y_im]]], _ = cv2.projectPoints(np.array([(x, y, z)]), rvec, tvec, camera_intrinsics, None)

          cv2.circle(vis, (int(x_im), int(y_im)), 1, (255, 255, 255), -1)

        ## draw edge of globe
        for j in range(0, 361, 5):
          x, y, z, _ = surface_point(j, 90, model_globe)
          [[[x_im, y_im]]], _ = cv2.projectPoints(np.array([(x, y, z)]), rvec, tvec, camera_intrinsics, None)
          cv2.circle(vis, (int(x_im), int(y_im)), 1, (255, 255, 255), -1)
  dt = clock() - t

  draw_str(vis, (20, 20), 'time: %.1f ms' % (dt*1000))

  cv2.imshow('camera', vis)

  if 0xFF & cv2.waitKey(5) == 27:
    break

cam.release()
cv2.destroyAllWindows()

