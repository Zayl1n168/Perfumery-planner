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
    // We use the hosted URL because the 3DS browser handles 
    // web security better than a custom local webview.
    const char* url = "https://perfumery-planner.web.app";

    while (aptMainLoop())
    {
        // Scan all the inputs
        hidScanInput();

        // hidKeysDown returns information about which buttons have just been pressed
        u32 kDown = hidKeysDown();

        if (kDown & KEY_START) break; // Exit loop and close app

        if (kDown & KEY_A) {
            printf("\x1b[12;1HLaunching...");
            
            // This is the magic command that opens the browser
            // Parameters: URL, Browser Profile, Initial Zoom, Browser ID
            aptOpenLibraryApplet(APPID_WEB, url, 0, 0);
        }

        // Flush and swap framebuffers
        gfxFlushBuffers();
        gfxSwapBuffers();

        // Wait for VBlank (syncs the frame rate to 60fps)
        gspWaitForVBlank();
    }

    // 4. Cleanup and exit back to the Homebrew Menu
    gfxExit();
    return 0;
}
