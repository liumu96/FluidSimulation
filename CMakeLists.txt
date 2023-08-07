cmake_minimum_required(VERSION 3.1)

project(incremental-fluids)

set(SRC "../lodepng/lodepng.h" "../lodepng/lodepng.cpp")

add_subdirectory(1-matrixless)
add_subdirectory(2-better-advection)
