package g.oid;

import android.app.NativeActivity;
import android.os.Bundle;
import android.view.WindowManager;

// native code activity wrapper
// needed to interact with the java world from c++
public class GeoidNativeActivity extends NativeActivity {

	@Override
	protected void onCreate(Bundle savedInstanceState) {
		super.onCreate(savedInstanceState);
		
		getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
	}
}
