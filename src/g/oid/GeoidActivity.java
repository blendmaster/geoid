package g.oid;

import org.opencv.android.BaseLoaderCallback;
import org.opencv.android.LoaderCallbackInterface;
import org.opencv.android.OpenCVLoader;
import android.app.Activity;
import android.content.Intent;
import android.util.Log;

/**
 * You've got the whole wide augmented world, in your augmented hands.
 */
public class GeoidActivity extends Activity {
	
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
				
				System.loadLibrary("geoid");
				Intent intent = new Intent(GeoidActivity.this, android.app.NativeActivity.class);
                GeoidActivity.this.startActivity(intent);
			}
				break;
			default: {
				super.onManagerConnected(status);
			}
				break;
			}
		}

	};

}
