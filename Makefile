CP = cp -f
RM = rm -rf
GIT_GET = git clone --depth 1
MKDIR = mkdir -p

LIBSDIR = libs
BENDER = libs/bender
GESTURE = libs/gesture

BENDER_URL = https://github.com/bendr/bender.git
GESTURE_URL = https://github.com/dthevenin/Gesture.git

extern:	libs/flexo.js libs/pointer.js

$(LIBSDIR):
	$(MKDIR) $(LIBSDIR)

libs/flexo.js:	$(LIBSDIR)
	$(GIT_GET) -b uninstance $(BENDER_URL) $(BENDER)
	$(CP) $(BENDER)/flexo.js $@

libs/pointer.js: $(LIBSDIR)
	$(GIT_GET) $(GESTURE_URL) $(GESTURE)
	$(CP) $(GESTURE)/build/vs_pointer_standalone_min.js $@

realclean:
	$(RM) libs
