#include <3ds.h>
#include <stdio.h>
#include <string.h>

int main(int argc, char* argv[])
{
    // 1. Initialize the 3DS graphics and console
    gfxInitDefault();
    consoleInit(GFX_TOP, NULL); // Use the TOP screen for text instructions

    // 2. Setup colors and UI text
    printf("\x1b[1;1HFragrance Maker 3DS v1.0");
    printf("\x1b[3;1H--------------------------");
    printf("\x1b[5;1HPress [A] to launch the app");
    printf("\x1b[6;1H(Opens in 3DS Browser)");
    printf("\x1b[10;1HPress START to exit to Homebrew");

    // 3. Your specific Firebase URL
    const char* url = "https://perfumery-planner.web.app";

    while (aptMainLoop())
    {
        hidScanInput();
        u32 kDown = hidKeysDown();

        if (kDown & KEY_START) break; 

        if (kDown & KEY_A) {
            printf("\x1b[12;1HLaunching...");
            
            // Corrected function name for modern libctru
            // Parameters: Applet ID, Pointer to data (URL), Size of data, Browser type
            aptLaunchLibraryApplet(APPID_WEB, (void*)url, strlen(url) + 1, 0);
        }

        gfxFlushBuffers();
        gfxSwapBuffers();
        gspWaitForVBlank();
    }

    gfxExit();
    return 0;
}
