# Add project specific ProGuard rules here.
# By default, the flags in this file are appended to flags specified
# in ${sdk.dir}/tools/proguard/proguard-android.txt

# kotlinx.serialization
-keepattributes *Annotation*, InnerClasses
-dontnote kotlinx.serialization.AnnotationsKt

-keepclassmembers class kotlinx.serialization.json.** { *** Companion; }
-keepclasseswithmembers class kotlinx.serialization.json.** {
    kotlinx.serialization.KSerializer serializer(...);
}

-keep,includedescriptorclasses class dev.serika.maps.**$$serializer { *; }
-keepclassmembers class dev.serika.maps.** {
    *** Companion;
}
-keepclasseswithmembers class dev.serika.maps.** {
    kotlinx.serialization.KSerializer serializer(...);
}

# Android Car App Library
-keep class androidx.car.app.** { *; }
