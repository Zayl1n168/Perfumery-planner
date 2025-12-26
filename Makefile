# TARGET is the name of the file you'll install on your 3DS
TARGET		:=	FragranceMaker
BUILD		:=	build
SOURCES		:=	source
DATA		:=	data
INCLUDES	:=	include
ROMFS		:=	romfs

# The 3DS-specific tools provided by devkitARM
ifeq ($(strip $(DEVKITARM)),)
$(error "Please set DEVKITARM in your environment. export DEVKITARM=<path to>devkitARM")
endif

include $(DEVKITARM)/3ds_rules

# Compiler flags
ARCH	:=	-march=armv6k -mtune=mpcore -mfloat-abi=hard -mtp=soft
CFLAGS	:=	-g -Wall -O2 -mword-relocations \
			-fomit-frame-pointer -ffunction-sections \
			$(ARCH)

# Libraries needed for the browser launch
LIBS	:= -lctru -lm

# The rule to build the 3DSX file
all: $(TARGET).3dsx

$(TARGET).3dsx: $(TARGET).elf

$(TARGET).elf:
	@mkdir -p $(BUILD)
	$(CC) $(CFLAGS) -I$(INCLUDES) $(SOURCES)/main.cpp $(LIBS) -o $(TARGET).elf
	
clean:
	@rm -rf $(BUILD) $(TARGET).elf $(TARGET).3dsx
