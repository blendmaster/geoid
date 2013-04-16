package g.oid;

import org.opencv.android.BaseLoaderCallback;
import org.opencv.android.CameraBridgeViewBase;
import org.opencv.android.CameraBridgeViewBase.CvCameraViewFrame;
import org.opencv.android.CameraBridgeViewBase.CvCameraViewListener2;
import org.opencv.android.LoaderCallbackInterface;
import org.opencv.android.OpenCVLoader;
import org.opencv.core.Core;
import org.opencv.core.Mat;
import org.opencv.core.MatOfDMatch;
import org.opencv.core.MatOfKeyPoint;
import org.opencv.core.Scalar;
import org.opencv.features2d.DMatch;
import org.opencv.features2d.DescriptorExtractor;
import org.opencv.features2d.DescriptorMatcher;
import org.opencv.features2d.FeatureDetector;
import org.opencv.features2d.Features2d;
import org.opencv.features2d.KeyPoint;
import org.opencv.imgproc.Imgproc;

import android.app.Activity;
import android.os.Bundle;
import android.util.Log;
import android.view.SurfaceView;
import android.view.View;
import android.view.View.OnClickListener;
import android.view.Window;
import android.view.WindowManager;

/**
 * You've got the whole wide augmented world, in your augmented hands.
 */
public class GeoidActivity extends Activity implements CvCameraViewListener2 {
	private CameraBridgeViewBase cameraView;

	@Override
	protected void onCreate(Bundle savedInstanceState) {
		super.onCreate(savedInstanceState);
		
        requestWindowFeature(Window.FEATURE_NO_TITLE);
        getWindow().setFlags(WindowManager.LayoutParams.FLAG_FULLSCREEN, 
                                WindowManager.LayoutParams.FLAG_FULLSCREEN);

		setContentView(R.layout.activity_geoid);

		final View contentView = findViewById(R.id.camera_preview);

		cameraView = (CameraBridgeViewBase) contentView;
		cameraView.setVisibility(SurfaceView.VISIBLE);

		cameraView.setCvCameraViewListener(this);
	}
	
	@Override
	protected void onPause() {
		super.onPause();

		if (cameraView != null) {
			cameraView.disableView();
		}
	}

	@Override
	protected void onDestroy() {
		super.onDestroy();

		if (cameraView != null) {
			cameraView.disableView();
		}
	}

	@Override
	protected void onResume() {
		super.onResume();
		OpenCVLoader.initAsync(OpenCVLoader.OPENCV_VERSION_2_4_3, this,
				loaderCallback);
	}

	private BaseLoaderCallback loaderCallback = new BaseLoaderCallback(this) {
		@Override
		public void onManagerConnected(int status) {
			switch (status) {
			case LoaderCallbackInterface.SUCCESS: {
				Log.i("geoid", "OpenCV loaded successfully");
				initOpenCVVariables();

				cameraView.enableView();

				// when screen is touched, grab features from next frame
				cameraView.setOnClickListener(new OnClickListener() {

					@Override
					public void onClick(View v) {
						grabFeatures = true;
					}
				});
			}
				break;
			default: {
				super.onManagerConnected(status);
			}
				break;
			}
		}

	};

	@Override
	public void onCameraViewStarted(int width, int height) {
		// nothing
	}

	@Override
	public void onCameraViewStopped() {
		// nothing
	}

	// TODO pull out feature detection logic into separate file
	private FeatureDetector detector;
	private DescriptorExtractor extractor;
	private DescriptorMatcher matcher;

	// the current set of descriptors, and the set of descriptors to match
	private Mat queryDescriptors, trainDescriptors;

	// these Mats are declared as members and reused to prevent new allocations
	// every frame, which android's garbage detector is bad at handling
	private Mat rgb, output, input;

	private void initOpenCVVariables() {
		detector = FeatureDetector.create(FeatureDetector.ORB);
		extractor = DescriptorExtractor.create(DescriptorExtractor.ORB);
		matcher = DescriptorMatcher
				.create(DescriptorMatcher.BRUTEFORCE_HAMMINGLUT);

		rgb = new Mat();
		output = new Mat();

		queryDescriptors = new Mat();
		trainDescriptors = new Mat();

		pointColor = new Scalar(255, 255, 255);
	}

	private boolean grabFeatures = true, trained = false;

	private Scalar pointColor;

	@Override
	public Mat onCameraFrame(CvCameraViewFrame inputFrame) {
		input = inputFrame.rgba();
		Imgproc.cvtColor(input, rgb, Imgproc.COLOR_RGBA2RGB);

		MatOfKeyPoint keypoints = new MatOfKeyPoint();
		detector.detect(rgb, keypoints);

		// set matching descriptors to this set of features
		if (grabFeatures) {
			Log.d("geoid", "grabbing features from current frame...");
			extractor.compute(rgb, keypoints, trainDescriptors);

			grabFeatures = false;
			trained = true;

			// show just the keypoints
			Features2d.drawKeypoints(rgb, keypoints, rgb);

		} else if (trained) {
			// match current image with existing descriptors

			extractor.compute(rgb, keypoints, queryDescriptors);

			MatOfDMatch matches = new MatOfDMatch();
			matcher.match(queryDescriptors, trainDescriptors, matches);

			DMatch[] matchesArray = matches.toArray();

			float min = Float.POSITIVE_INFINITY, max = 0;
			for (DMatch dMatch : matchesArray) {
				float d = dMatch.distance;
				if (d > max) {
					max = d;
				}
				if (d < min) {
					min = d;
				}
			}

			float threshold = (float) (1.2 * min);

			// draw good, matching keypoints
			KeyPoint[] points = keypoints.toArray();
			for (DMatch d : matchesArray) {
				KeyPoint keypoint = points[d.queryIdx];
				if (d.distance < threshold) {
					Core.putText(rgb, "" + d.trainIdx, keypoint.pt,
							Core.FONT_HERSHEY_PLAIN, 1, pointColor);
				}
			}

		} else {
			// descriptors haven't been grabbed yet, just show input with
			// keypoints

			Features2d.drawKeypoints(rgb, keypoints, rgb);
		}

		Imgproc.cvtColor(rgb, output, Imgproc.COLOR_RGB2RGBA);
		return output;
	}
}
