# simulated pose estimation of a globe from 2D points on the globe's surface.
#
# In real life, the points could be LEDs on the globe's surface for easy
# detection using thresholding and region centroids.
import cv2
import numpy as np
import random
from video import create_capture
from common import clock, draw_str

# Nexus S rear camera, preview mode in OpenCV
width  = 640.0
height = 480.0

def project(point3d, camera_intrinsics, camera_extrinsics):
  x, y, z = point3d

  #[[x_c], [y_c], [z_c]] = np.dot(camera_extrinsics, np.array([[x], [y], [z], [1]]))

  #leng = np.sqrt(x_c**2 + y_c**2 + z_c**2)

  #x_c = x_c / leng
  #y_c = y_c / leng
  #z_c = z_c / leng

  projection_matrix = np.dot(camera_intrinsics, camera_extrinsics)
  [[x1], [x2], [x3]] = np.dot(projection_matrix, np.array([[x], [y], [z], [1]]))

  #[[x_im], [y_im], [z_im]] = np.dot(camera_intrinsics, np.array([[x_c], [y_c], [z_c]]))

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

def simulated_image(points, camera_intrinsics, camera_extrinsics, globe_pose):
  """From a camera pose and globe pose in world coordinates, an image
  containing the projected points on the globe, with a bit of noise and
  extraneous parts."""

  img = np.zeros((height, width, 3), np.uint8)

  #points = []
  #for x in range(-20, 21, 4):
    #for y in range(-20, 21, 4):
      #for z in range(-20, 21, 4):
        #points.append((x / 10.0, y / 10.0, 19 + z / 10.0,
          #(((x + 10) / 20.0) * 255, ((y + 10) / 20.0) * 255, 127 +
            #((z + 10) / 20.0) * 127)))

  camera_pos = np.array([camera_extrinsics[0][3],
                         camera_extrinsics[1][3],
                         camera_extrinsics[2][3]])

  for point in points:
    lat, lon, (r,g,b) = point
    x, y, z, norm = surface_point(point[0], point[1], globe_pose)

    #x, y, z, (r, g, b) = point

    #print("norm: (%f, %f, %f)" % (norm[0], norm[1], norm[2]))

    x_im, y_im = project((x, y, z), camera_intrinsics, camera_extrinsics)

    eye_ray = np.array([x, y, z]) - camera_pos
    eye_ray = eye_ray / np.linalg.norm(eye_ray)
    #print("eye_ray:", eye_ray)

    #print("x: %f, y: %f" % (x_im, y_im))

    # peturb randomly
    x_im = x_im + random.randint(0, 10)
    y_im = y_im + random.randint(0, 10)

    # if in range
    if 0 < x_im < width and 0 < y_im < height:
      # if on front face
      if np.dot(eye_ray, norm) > 0:
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

def estimated_pose(camera_intrinsics, camera_extrinsics, image, points, globe_pose):
  """The estimated pose from an image, using opencv"""

  camera_pos = np.array([camera_extrinsics[0][3],
                         camera_extrinsics[1][3],
                         camera_extrinsics[2][3]])

  radius, gx, gy, gz, _, _, _ = globe_pose

  # model globe pose
  model_globe = (radius, 0, 0, 0, 0, 0, 0)

  gray = cv2.cvtColor(image, cv2.COLOR_RGB2GRAY)

  thresholded = cv2.adaptiveThreshold(
      gray,
      255,
      cv2.ADAPTIVE_THRESH_MEAN_C,
      cv2.THRESH_BINARY,
      7,
      0)

  # remove noise if needed (maybe with nice thresholding / camera exposure, it
  # won't be necessary
  #cv.open(image)

  contours, hierarchy = cv2.findContours(
      thresholded,
      cv2.RETR_TREE,
      cv2.CHAIN_APPROX_SIMPLE)

  object_points = []
  image_points = []
  centroids = np.zeros_like(thresholded)
  for i, contour in enumerate(contours):
    m = cv2.moments(contour)
    xim, yim = ( m['m10']/m['m00'],m['m01']/m['m00'] )
    cv2.circle(centroids, (int(xim), int(yim)), 1, 255, -1)

    # find average color in original image
    mask = np.zeros_like(thresholded, dtype=np.uint8)
    cv2.drawContours(mask, contours, i, 1, -1)
    b, g, r, _ = cv2.mean(image, mask)

    # find matches in trained points
    for j, point in enumerate(points):
      lat, lon, (pr, pg, pb) = point

      dist = np.sqrt((float(pr) - r)**2 + (float(pg) - g)**2 + (float(pb) - b)**2)
      if dist < 30:
        x, y, z, _ = surface_point(lat, lon, model_globe)
        object_points.append([x, y, z])
        image_points.append([xim, yim])

  cv2.namedWindow('threshold')
  cv2.imshow('threshold', centroids)

  print(object_points)
  print(image_points)

  # in model coordinates
  #object_points = []
  #image_points = []

  #for point in points:
    #lat, lon, (r,g,b) = point
    #x, y, z, norm = surface_point(point[0], point[1], globe_pose)

    #xm, ym, zm, _ = surface_point(point[0], point[1], model_globe)

    #x_im, y_im = project((x, y, z), camera_intrinsics, camera_extrinsics)

    #eye_ray = np.array([x, y, z]) - camera_pos
    #eye_ray = eye_ray / np.linalg.norm(eye_ray)

    ## peturb randomly
    ##x_im = x_im + random.randint(0, 10)
    ##y_im = y_im + random.randint(0, 10)

    ## if in range
    #if 0 < x_im < width and 0 < y_im < height:
      ## if on front face
      #if np.dot(eye_ray, norm) > 0:
        ## add to points
        #image_points.append([int(x_im), int(y_im)])

        ## subtract globe center
        #object_points.append([xm * 1.0, ym * 1.0, zm * 1.0])

  #print(object_points)
  #print(image_points)

  rvec, tvec, inliers = cv2.solvePnPRansac(np.array(object_points, dtype=np.float32), np.array(image_points, dtype=np.float32),
                                    camera_intrinsics, None)

  #print tvec

  [[est_x], [est_y], [est_z]] = tvec
  [[est_rx], [est_ry], [est_rz]] = rvec

  return (radius, est_x, est_y, est_z, est_rx, est_ry, est_rz)

def simulate(camera_intrinsics, camera_extrinsics, globe_pose, points):
  """Simulate capturing an image of the globe and its points, then estimating
  the pose of the globe from the image."""

  image = simulated_image(points,
                          camera_intrinsics,
                          camera_extrinsics,
                          globe_pose)

  estimated_globe_pose = estimated_pose(camera_intrinsics,
                                        camera_extrinsics,
                                        image, points, globe_pose)

  print(estimated_globe_pose)

  # draw real outline of globe
  x_im_or, y_im_or = project((globe_pose[1], globe_pose[2], globe_pose[3]), camera_intrinsics, camera_extrinsics)
  x_im_ed, y_im_ed = project((globe_pose[1] + globe_pose[0], globe_pose[2], globe_pose[3]), camera_intrinsics, camera_extrinsics)
  radius_im = np.sqrt((x_im_ed - x_im_or)**2 + (y_im_ed - y_im_or)**2)
  cv2.circle(image, (int(x_im_or), int(y_im_or)), int(radius_im), (255, 255, 255), 1)

  # draw estimated outline of the globe
  x_im_or, y_im_or = project((estimated_globe_pose[1], estimated_globe_pose[2], estimated_globe_pose[3]), camera_intrinsics, camera_extrinsics)
  x_im_ed, y_im_ed = project((estimated_globe_pose[1] + estimated_globe_pose[0], estimated_globe_pose[2], estimated_globe_pose[3]), camera_intrinsics, camera_extrinsics)
  radius_im = np.sqrt((x_im_ed - x_im_or)**2 + (y_im_ed - y_im_or)**2)
  cv2.circle(image, (int(x_im_or), int(y_im_or)), int(radius_im), (255, 0, 0), 1)

  cv2.namedWindow('w')
  cv2.imshow('w', image)

fov = 30.41 # of the rear camera, in degrees, across the diagonal

fov_angle = np.arctan(height / width)

fov_x = fov * np.cos(fov_angle)
fov_y = fov * np.sin(fov_angle)

fx = (width / 2) / np.tan(fov_x / 2)
fy = (height / 2) / np.tan(fov_y / 2)

# K
# XXX how am I supposed to get square pixels with two different fov's? I dunno
# how this is supposed to work
camera_intrinsics = np.array([[fy , 0  , width / 2 ]   ,
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

#print(camera_extrinsics)
#print(camera_intrinsics)
#print(np.dot(camera_intrinsics, camera_extrinsics))

# radius, x, y, z, xrot (around x axis), yrot, zrot
globe_pose = (1, 0, 0, 30, 30, 30, 0)

# points on a globe by latitude and longitude, and color (rgb)
points = [
  (51.5171, -0.1062, (255, 255, 255)), # london
  (28.6667, 77.2167, (255, 0, 0)), # new delhi
  (31.7833, 35.2167, (0, 255, 0)),  # jerusalem
  (40.7142, -74.0064, (0, 0, 255)), # new york
  (33.5992, -7.6200, (127, 0, 0)), # casablanca
  (-33.9767, 18.4244, (255, 0, 255)), # cape town
  (-22.9083, -43.2436, (255, 255, 0)), # rio de janeiro
]

#test points

#for i in range(-90, 91, 10):

#for j in range(0, 361, 10):
  #points.append((0, j, ((j + 90.0) / 180.0 * 255, (j + 90.0) / 180.0 * 255, 255)))
#for j in range(-90, 90, 10):
  #points.append((j, 0, ((j + 90.0) / 180.0 * 255, (j + 90.0) / 180.0 * 255, 255)))

#simulate(camera_intrinsics, camera_extrinsics, globe_pose, points)

cam = create_capture(0)

cam.set(cv2.cv.CV_CAP_PROP_BRIGHTNESS, 0.5)
cam.set(cv2.cv.CV_CAP_PROP_EXPOSURE, -0.9)
cam.set(cv2.cv.CV_CAP_PROP_GAIN, 0)
cam.set(cv2.cv.CV_CAP_PROP_SATURATION, 1)

#def nothing(_=None):
  #return

#cv2.namedWindow('camera')
#cv2.createTrackbar('h', 'camera', 0, 255, nothing)
#cv2.createTrackbar('hm', 'camera', 255, 255, nothing)
#cv2.createTrackbar('s', 'camera', 0, 255, nothing)
#cv2.createTrackbar('sm', 'camera', 255, 255, nothing)
#cv2.createTrackbar('v', 'camera', 0, 255, nothing)
#cv2.createTrackbar('vm', 'camera', 255, 255, nothing)
#cv2.createTrackbar('op', 'camera', 2, 20, nothing)

detector = cv2.ORB( nfeatures = 1000 )
FLANN_INDEX_KDTREE = 1
FLANN_INDEX_LSH    = 6
flann_params= dict(algorithm = FLANN_INDEX_LSH,
                   table_number = 6, # 12
                   key_size = 12,     # 20
                   multi_probe_level = 1) #2
matcher = cv2.FlannBasedMatcher(flann_params, {})  # bug : need to pass empty dict (#1329)

# grab training data
us = cv2.imread('us.png', 1)
canada = cv2.imread('canada.png', 1)
centralam = cv2.imread('centralam.png', 1)

us_kp, us_desc = detector.detectAndCompute(us, None)
canada_kp, canada_desc = detector.detectAndCompute(canada, None)
centralam_kp, centralam_desc = detector.detectAndCompute(centralam, None)

# lat, lon mapping from image points, assuming flat images
us_rect = ((48.969, -118.780), (26.946, -85.834))
canada_rect = ((64.597, -152.851), (39.502, -71.480))
centralam_rect = ((31.26, -114.82), (2.8733, -67.379))

def to_globe(im, imshape, rect):
  x, y = im
  height, width, _ = imshape

  (lat1, lon1), (lat2, lon2) = rect

  latheight = lat2 - lat1
  lonwidth = lon2 - lon1

  imwr = float(x) / float(width)
  lon = lon1 + imwr * lonwidth

  imhr = float(y) / float(height)
  lat = lat1 + imhr * latheight

  return (lat, lon)

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

  vis = img

  img_kp, img_desc = detector.detectAndCompute(img, None)

  us_raw_matches = matcher.knnMatch(img_desc, trainDescriptors=us_desc, k = 2) #2
  p1, p2, kp_pairs_us = filter_matches(img_kp, us_kp, us_raw_matches)

  canada_raw_matches = matcher.knnMatch(img_desc, trainDescriptors=canada_desc, k = 2) #2
  p1, p2, kp_pairs_canada = filter_matches(img_kp, canada_kp, canada_raw_matches)

  centralam_raw_matches = matcher.knnMatch(img_desc, trainDescriptors=centralam_desc, k = 2) #2
  p1, p2, kp_pairs_centralam = filter_matches(img_kp, centralam_kp, centralam_raw_matches)

  object_points = []
  image_points = []
  matches_from_us = np.int32([kpp[0].pt for kpp in kp_pairs_us])
  for p in matches_from_us:
    cv2.circle(vis, (p[0], p[1]), 2, (255, 0, 0), -1)
    image_points.append(p)
    object_points.append(to_globe(p, us.shape, us_rect))

  matches_from_canada = np.int32([kpp[0].pt for kpp in kp_pairs_canada])
  for p in matches_from_canada:
    cv2.circle(vis, (p[0], p[1]), 2, (0, 255, 0), -1)
    image_points.append(p)
    object_points.append(to_globe(p, canada.shape, canada_rect))

  matches_from_centralam = np.int32([kpp[0].pt for kpp in kp_pairs_centralam])
  for p in matches_from_centralam:
    cv2.circle(vis, (p[0], p[1]), 2, (0, 0, 255), -1)
    image_points.append(p)
    object_points.append(to_globe(p, centralam.shape, centralam_rect))

  radius = 1
  model_globe = (radius, 0, 0, 0, 0, 0, 0)

  globe_points = []
  for lat, lon in object_points:
    x, y, z, _ = surface_point(lat, lon, model_globe)

    globe_points.append((x, y, z))

  if len(image_points) > 4:
    obj = np.array(globe_points, dtype=np.float32)
    im = np.array(image_points, dtype=np.float32)

    N = obj.shape[0]

    rvec, tvec, inliers = cv2.solvePnPRansac(obj.reshape([1, N, 3]), im.reshape([1, N, 2]),
                                      camera_intrinsics, None #flags=cv2.CV_P3P
                                      )

    #print tvec

    if inliers != None:
      for i in inliers:
        p = image_points[i]
        cv2.circle(vis, (p[0], p[1]), 2, (255, 255, 255), -1)
        o = object_points[i]
        draw_str(vis, p, '%.1f %.1f' % (o[0], o[1]))


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

