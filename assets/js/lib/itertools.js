'use strict';

const itertools = (() => {

    function* filter ( predicate , iterable ) {
        for ( const item of iterable ) {
            if (predicate(item)) yield item ;
        }
    }

    function* map ( callable , iterable ) {
        for ( const item of iterable ) yield callable(item) ;
    }

    function* keys ( object ) {
        // use Object.keys instead?
        for ( const key in object ) yield key ;
    }

    function* values ( object ) {
        // use Object.values instead?
        for ( const key in object ) yield object[key] ;
    }

    function* items ( object ) {
        // use Object.entries instead?
        for ( const key in object ) yield [key, object[key]] ;
    }

    return {
        filter,
        map,
        keys,
        values,
        items,
    } ;

})() ;
